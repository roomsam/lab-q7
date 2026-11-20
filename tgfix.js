// test
line2// TG Πρόβλεψη · «Διορθώσεις ημέρας» (από 20/11/2026).
// Κάθε μέρα μία διόρθωση από τα λάθη της ημέρας, ως ΦΙΛΤΡΟ πάνω στα σήματα — το μοντέλο δεν ξαναεκπαιδεύεται.
// Το σήμα που κόβεται δεν σβήνει: φαίνεται «⛔ μπλοκ» με τον λόγο, και μετράμε ζωντανά και τις δύο εκδοχές
// (με και χωρίς τη διόρθωση). Αν μια διόρθωση χάνει σε βάθος εβδομάδας, βγαίνει.
//
// Διόρθωση #1 (20/11/2026): κανένα LONG στα 4H / 4H+M / 1D όταν ταυτόχρονα
//   (α) το BTC είναι σε πτωτική τάση (ημερήσιο κλείσιμο κάτω από τον μέσο 20 ημερών, και ο μέσος πέφτει σε 5 μέρες),
//   (β) το πλήθος στο BTC είναι φορτωμένο long (funding 3ημ. / L/S λογαριασμών / L/S top στο 95% του έτους — ίδια όρια με το «Γύρισμα αγοράς»),
//   (γ) ΔΕΝ έχει γίνει ξεφόρτωμα OI (OI 24ω ≤ −4% με πτώση τιμής) τις τελευταίες 72 ώρες.
// Αφορμή: 20/11 το 1D έδωσε 11 ισχυρά long μέσα σε πτώση με πλήθος φορτωμένο long → 6/11 stop την ίδια μέρα.
//
// Διόρθωση #2 (20/11/2026): «γύρισμα με απότομο OI». Σε 15′: το OI πέφτει απότομα (≤ 1 ώρα) ενώ πέφτει η τιμή = καθάρισμα longs.
//   Αν μετά η τιμή ξαναπάρει ≥ 50% της πτώσης μέσα σε 2 ώρες (15′ κλείσιμο) → «🔄 γύρισμα επιβεβαιωμένο».
//   Στο BTC το επιβεβαιωμένο γύρισμα (τελευταίες 24ω) μετράει ως ξεφόρτωμα για τη διόρθωση #1 → τα long ξεμπλοκάρουν πιο γρήγορα.
//   Όρια αρχικά, χωρίς μέτρηση: OI ≤ −1,5% (BTC/ETH) ή ≤ −2,5% (υπόλοιπα) σε ≤ 4 κεριά 15′. Μετριούνται ζωντανά στο BTC (30 μέρες).
(function(){
"use strict";
const API="https://fapi.binance.com";
const TH={fr_hi:0.000090,ls_hi:2.782,tt_hi:3.213,oi24_lo:-0.0401}; // = tgturn.js (14/11/2026)
const H4=144e5,D1=864e5,FEE=8,LOOK=18;
const FIXES=[
  {id:1,date:"20/11/2026",tfs:["4h","4hm","1d"],title:"Όχι LONG σε πτωτική τάση με πλήθος φορτωμένο long",
   why:"20/11: 11 ισχυρά long του 1D μέσα σε πτώση, πλήθος φορτωμένο long, χωρίς ξεφόρτωμα OI → 6/11 stop την ίδια μέρα. Ίδιο μοτίβο με τις αγορές του 4H (1 στις 31)."},
  {id:2,date:"20/11/2026",tfs:[],title:"Γύρισμα με απότομο ξεφόρτωμα OI (15′)",
   why:"Το καθάρισμα (OI πέφτει απότομα με την τιμή και μετά η τιμή ξαναπαίρνει) συχνά σημαδεύει πάτο. Το 24ωρο ξεφόρτωμα της #1 έρχεται αργά· αυτό το πιάνει μέσα στην ώρα."}
];
const SYMS2=["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","BNBUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT","LINKUSDT","SUIUSDT","LTCUSDT","HYPEUSDT","AAVEUSDT","BCHUSDT","DOTUSDT","NEARUSDT","PUMPUSDT","RUNEUSDT","TRXUSDT","XMRUSDT","ZECUSDT","XAUUSDT"];
const M15=9e5,THR2=s=>(s==="BTCUSDT"||s==="ETHUSDT")?-0.015:-0.025;
// Γεγονότα «απότομου ξεφορτώματος OI» σε 15′. oi=[[t,oi]], k=[[tClose,h,l,c]] (ταξινομημένα).
function turns(s,oi,k){
  const ev=[];if(oi.length<8||k.length<8)return ev;const thr=THR2(s);
  const kAt=t=>{let v=-1;for(let i=0;i<k.length;i++){if(k[i][0]<=t)v=i;else break}return v};
  let skip=-1;
  for(let i=4;i<oi.length;i++){if(i<=skip)continue;
    for(let w=1;w<=4;w++){const a=oi[i-w],b=oi[i];const d=Math.log(b[1]/a[1]);if(d>thr)continue;
      const ka=kAt(a[0]),kb=kAt(b[0]);if(ka<0||kb<0||kb<=ka)continue;const p0=k[ka][3],p1=k[kb][3];if(!(p1<p0))continue;
      let lo=Infinity;for(let x=ka;x<=kb;x++)lo=Math.min(lo,k[x][2]);
      const lvl=lo+0.5*(p0-lo);let conf=null;
      for(let x=kb+1;x<=Math.min(k.length-1,kb+8);x++){lo=Math.min(lo,k[x][2]);if(k[x][3]>=lo+0.5*(p0-lo)){conf={t:k[x][0],c:k[x][3],ix:x};break}}
      ev.push({s,t:b[0],d,dp:Math.log(p1/p0),p0,lo,conf,live:!conf&&kb+8>k.length-1});skip=i+4;break}}
  return ev;
}
let T2=null,T2AT=0,T2H=null; // ζωντανά 22 σύμβολα · ιστορικό BTC 30 ημ.
async function oi15(s,end){return(await J(`${API}/futures/data/openInterestHist?symbol=${s}&period=15m&limit=500${end?"&endTime="+end:""}`)).map(x=>[+x.timestamp,+x.sumOpenInterest])}
async function k15(s,end,lim){return(await J(`${API}/fapi/v1/klines?symbol=${s}&interval=15m&limit=${lim||500}${end?"&endTime="+end:""}`)).map(x=>[+x[0]+M15,+x[2],+x[3],+x[4]])}
async function loadTurns(){
  const out={};
  for(let i=0;i<SYMS2.length;i+=6){await Promise.all(SYMS2.slice(i,i+6).map(async s=>{try{const [o,k]=await Promise.all([J(`${API}/futures/data/openInterestHist?symbol=${s}&period=15m&limit=48`).then(a=>a.map(x=>[+x.timestamp,+x.sumOpenInterest])),k15(s,0,60)]);out[s]=turns(s,o.sort((a,b)=>a[0]-b[0]),k.sort((a,b)=>a[0]-b[0]))}catch(e){out[s]=null}}))}
  T2=out;T2AT=Date.now();
  if(!T2H||Date.now()-T2H.at>36e5){ // ιστορικό BTC ~30 ημέρες (όσο κρατά η Binance) για μέτρηση
    let O=[],K=[],end=0;for(let p=0;p<6;p++){const o=await oi15("BTCUSDT",end);if(!o.length)break;O=o.concat(O);end=o[0][0]-1}
    end=0;for(let p=0;p<7;p++){const k=await k15("BTCUSDT",end);if(!k.length)break;K=k.concat(K);end=k[0][0]-M15-1}
    const so=a=>{const m=new Map();for(const x of a)m.set(x[0],x);return[...m.values()].sort((a,b)=>a[0]-b[0])};O=so(O);K=so(K);
    const E=turns("BTCUSDT",O,K).filter(e=>e.conf);const fwd=(t,h)=>{const i=K.findIndex(x=>x[0]>=t);const j=K.findIndex(x=>x[0]>=t+h);return i<0||j<0?null:Math.log(K[j][3]/K[i][3])*1e4};
    const R=E.map(e=>({t:e.conf.t,r4:fwd(e.conf.t,144e5),r24:fwd(e.conf.t,864e5)}));
    const base=(h)=>{const v=[];for(let i=0;i+h/M15<K.length;i+=4)v.push(Math.log(K[i+h/M15][3]/K[i][3])*1e4);return v.length?v.reduce((a,b)=>a+b,0)/v.length:NaN};
    T2H={at:Date.now(),from:O.length?O[0][0]:0,R,b4:base(144e5),b24:base(864e5)};
  }
}
function btcTurn24(T){if(!T2||!T2.BTCUSDT)return null;return T2.BTCUSDT.find(e=>e.conf&&e.conf.t<=T&&e.conf.t>T-864e5)||null}
const $=id=>document.getElementById(id),fin=Number.isFinite;
const J=async u=>{const r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()};
const f1=v=>fin(v)?v.toFixed(1).replace(".",","):"—";
let D=null,DAT=0,busy=false,err=null,lastKey="";

async function load(){
  const [fr,ls,tt,oi,k4,kd]=await Promise.all([
    J(`${API}/fapi/v1/fundingRate?symbol=BTCUSDT&limit=300`),
    J(`${API}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=4h&limit=500`),
    J(`${API}/futures/data/topLongShortAccountRatio?symbol=BTCUSDT&period=4h&limit=500`),
    J(`${API}/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=500`),
    J(`${API}/fapi/v1/klines?symbol=BTCUSDT&interval=4h&limit=500`),
    J(`${API}/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=200`)]);
  const s=a=>a.sort((x,y)=>x[0]-y[0]);
  return{fr:s(fr.map(x=>[+x.fundingTime,+x.fundingRate])),
    ls:s(ls.map(x=>[+x.timestamp,+x.longShortRatio])),
    tt:s(tt.map(x=>[+x.timestamp,+x.longShortRatio])),
    oi:s(oi.map(x=>[+x.timestamp,+x.sumOpenInterest])),
    px:s(k4.map(k=>[+k[0]+H4,+k[4]])),          // [ώρα κλεισίματος 4H, κλείσιμο]
    d1:s(kd.map(k=>[+k[0]+D1,+k[4]]))};         // [ώρα κλεισίματος 1D, κλείσιμο]
}
function at(a,T){let v=null;for(const x of a){if(x[0]<=T)v=x;else break}return v}
// Κατάσταση τη στιγμή T (μόνο ό,τι ήταν γνωστό τότε).
function state(T){
  if(!D)return null;
  // (α) τάση BTC στο ημερήσιο
  const d=D.d1.filter(x=>x[0]<=T);let down=null,ma=NaN;
  if(d.length>=26){const c=d.map(x=>x[1]),n=c.length,m=i=>c.slice(i-20,i).reduce((a,b)=>a+b,0)/20;ma=m(n);down=c[n-1]<ma&&ma<m(n-5)}
  // (β) πλήθος
  const f=D.fr.filter(x=>x[0]<=T).slice(-9);const fr3=f.length>=6?f.reduce((s,x)=>s+x[1],0)/f.length:NaN;
  const ls=at(D.ls,T-1),tt=at(D.tt,T-1);const lsv=ls&&T-ls[0]<=2*H4?ls[1]:NaN,ttv=tt&&T-tt[0]<=2*H4?tt[1]:NaN;
  const crowd=(fin(fr3)&&fr3>=TH.fr_hi)||(fin(lsv)&&lsv>=TH.ls_hi)||(fin(ttv)&&ttv>=TH.tt_hi);
  // (γ) ξεφόρτωμα OI τις τελευταίες 72 ώρες
  let flush=null;
  for(const o of D.oi){if(o[0]>=T||o[0]<T-LOOK*H4)continue;
    const o0=at(D.oi,o[0]-6*H4),p1=at(D.px,o[0]),p0=at(D.px,o[0]-6*H4);
    if(!o0||!p1||!p0||o[0]-6*H4-o0[0]>H4)continue;
    const dd=Math.log(o[1]/o0[1]),dp=Math.log(p1[1]/p0[1]);if(dd<=TH.oi24_lo&&dp<0)flush={t:o[0],d:dd}}
  if(!flush){const bt=btcTurn24(T);if(bt)flush={t:bt.conf.t,d:bt.d,turn:true}}
  const ok=down!==null&&(fin(lsv)||fin(ttv))&&D.oi.length&&D.oi[0][0]<=T-LOOK*H4;
  return{T,ok,down,ma,fr3,ls:lsv,tt:ttv,crowd,flush};
}
// Μπλοκάρει το σήμα; T = ώρα κλεισίματος του κεριού του σήματος. Επιστρέφει {id,why} ή null.
function block(tf,sig,T){
  if(!(sig>0))return null;const fx=FIXES[0];if(!fx.tfs.includes(tf))return null;
  const st=state(T);if(!st||!st.ok)return null;
  if(st.down&&st.crowd&&!st.flush)return{id:1,why:"πτωτική τάση BTC · πλήθος φορτωμένο long · χωρίς ξεφόρτωμα OI"};
  return null;
}
window.TGFIX={block,state,ready:()=>!!D,FIXES};

// ---------- εμφάνιση: σημάδι «⛔ μπλοκ» πάνω στα σήματα της σελίδας (δεν αλλάζει τον υπολογισμό τους) ----------
function curTF(){try{return cur}catch(e){return null}}
function curSel(){try{return sel}catch(e){return null}}
function cacheOf(tf){try{return CACHE[tf]}catch(e){return null}}
function msOf(tf){try{return TFS[tf].ms}catch(e){return 0}}
function mark(){
  if(!D)return;const tf=curTF(),C=cacheOf(tf);if(!C||!C.rows)return;const ms=msOf(tf);
  const rs=$("rs");
  if(rs)rs.querySelectorAll("tr.click").forEach(tr=>{const r=C.rows[tr.dataset.s];if(!r||!(r.sig>0))return;const b=block(tf,r.sig,C.latest+ms);if(!b)return;
    const td=tr.lastElementChild;if(td&&!td.querySelector(".fixb")){td.insertAdjacentHTML("beforeend",` <span class="pill pdn fixb" title="Διόρθωση #${b.id}: ${b.why}">⛔ μπλοκ</span>`);tr.style.opacity=".55"}});
  const r=C.rows[curSel()];if(r&&r.sig>0){const b=block(tf,r.sig,C.latest+ms);if(b){const k=document.querySelector(".k.sig");
    if(k&&!k.querySelector(".fixb")){k.insertAdjacentHTML("beforeend",`<div class="sm dn fixb" style="margin-top:4px">⛔ <b>Μπλοκαρισμένο</b> από τη διόρθωση #${b.id}: ${b.why}. Δεν μπαίνει, δεν στέλνεται στο Discord· μετριέται μόνο.</div>`)}}}
}

// ---------- κάρτα «Διορθώσεις ημέρας» + ζωντανή μέτρηση με / χωρίς ----------
function card(){
  let el=$("tgfix");if(el)return el;const sh=$("shadow");if(!sh)return null;
  const c=document.createElement("div");c.className="card";
  c.innerHTML=`<div class="h">🛠 Διορθώσεις ημέρας · φίλτρα πάνω στα σήματα</div><div id="tgfix"><p class="mut sm">Φόρτωση…</p></div>`;
  sh.closest(".card").before(c);return $("tgfix");
}
function st(X){const n=X.length;if(!n)return{n:0};let w=0,s=0;for(const h of X){const bp=h.sig*h.o.r*1e4;s+=bp;if(bp>0)w++}return{n,win:w/n,avg:s/n,net:s-FEE*n}}
const cellS=T=>T.n?`<td>${T.n}</td><td>${Math.round(T.win*100)}%</td><td class="${T.avg>=0?"up":"dn"}">${f1(T.avg)} bp</td><td class="${T.net>=0?"up":"dn"}">${Math.round(T.net)} bp</td>`:`<td>0</td><td>—</td><td>—</td><td>—</td>`;
const tH=t=>new Date(t).toLocaleString("el-GR",{weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:"Europe/Athens"});
function turnsPart(fx){
  let h=`<div style="margin:14px 0 6px"><b>#${fx.id} · ${fx.date} · ${fx.title}</b><br><span class="sm mut">${fx.why} Όρια αρχικά, χωρίς μέτρηση: OI ≤ −1,5% (BTC/ETH) ή ≤ −2,5% (υπόλοιπα) σε ≤ 1 ώρα με πτώση τιμής · επιβεβαίωση = 15′ κλείσιμο που ξαναπαίρνει ≥ 50% της πτώσης μέσα σε 2 ώρες. Στο BTC το επιβεβαιωμένο γύρισμα ξεμπλοκάρει τα long της #1 για 24 ώρες.</span></div>`;
  if(!T2){return h+`<p class="sm mut">Φόρτωση 15′ OI…</p>`}
  const rows=[];for(const s in T2){const E=T2[s];if(!E||!E.length)continue;const e=E[E.length-1];if(Date.now()-(e.conf?e.conf.t:e.t)>6*36e5)continue;rows.push(e)}
  rows.sort((a,b)=>(b.conf?b.conf.t:b.t)-(a.conf?a.conf.t:a.t));
  if(!rows.length)h+=`<p class="sm">Κανένα απότομο ξεφόρτωμα OI τις τελευταίες 6 ώρες.</p>`;
  else h+=`<div class="scroll"><table><tr><th>Σύμβολο</th><th>Ώρα</th><th>OI</th><th>Τιμή</th><th>Κατάσταση</th></tr>${rows.map(e=>`<tr><td><b>${e.s.replace("USDT","")}</b></td><td>${tH(e.t)}</td><td class="dn">${(e.d*100).toFixed(1).replace(".",",")}%</td><td class="dn">${(e.dp*100).toFixed(1).replace(".",",")}%</td><td>${e.conf?`<span class="pill pup">🔄 γύρισμα επιβεβαιωμένο ${tH(e.conf.t)}</span>`:e.live?'<span class="pill pw">καθάρισμα · περιμένει ανάκτηση</span>':'<span class="pill pn">χωρίς ανάκτηση</span>'}</td></tr>`).join("")}</table></div>`;
  if(T2H){const R=T2H.R,f=k=>{const v=R.map(x=>x[k]).filter(fin);if(!v.length)return"—";const m=v.reduce((a,b)=>a+b,0)/v.length,w=v.filter(x=>x>0).length/v.length;return `${v.length} · ${Math.round(w*100)}% θετικά · μέσο ${f1(m)} bp`};
    h+=`<p class="sm">Μέτρηση BTC από ${T2H.from?tH(T2H.from):"—"} (όσο κρατά η Binance): επιβεβαιωμένα γυρίσματα → επόμενες 4ω: ${f("r4")} (κανονικό ${f1(T2H.b4)} bp) · επόμενες 24ω: ${f("r24")} (κανονικό ${f1(T2H.b24)} bp). Λίγα δείγματα = καμία απόφαση ακόμα.</p>`}
  return h;
}
function render(){
  const el=card();if(!el)return;
  if(err&&!D){el.innerHTML=`<p class="sm dn">Δεν φόρτωσαν τα δεδομένα BTC (${err}). Ξαναπροσπαθώ.</p>`;return}
  if(!D)return;
  const now=state(Date.now());
  let h=`<div class="note" style="margin-bottom:8px"><b>Πώς δουλεύει:</b> κάθε μέρα μία διόρθωση από τα λάθη της ημέρας, ως φίλτρο. Το σήμα που κόβεται φαίνεται <span class="pill pdn">⛔ μπλοκ</span> και δεν πάει στο Discord. Μετράμε ζωντανά και τις δύο εκδοχές· αν μια διόρθωση χάνει σε βάθος εβδομάδας, βγαίνει.</div>`;
  for(const fx of FIXES){
    if(fx.id===2){h+=turnsPart(fx);continue}
    const active=now&&now.ok&&now.down&&now.crowd&&!now.flush;
    h+=`<div style="margin:6px 0"><b>#${fx.id} · ${fx.date} · ${fx.title}</b> <span class="pill ${active?"pdn":"pn"}">${active?"ενεργό τώρα":"ανενεργό τώρα"}</span><br><span class="sm mut">${fx.why} Ισχύει για: ${fx.tfs.map(t=>({"4h":"4H","4hm":"4H+M","1d":"1D"})[t]).join(", ")}.</span></div>`;
    if(now)h+=`<div class="sm" style="margin:2px 0 8px">Τώρα: τάση BTC ${now.down===null?"—":now.down?'<b class="dn">πτωτική</b>':'<span class="up">όχι πτωτική</span>'} (μέσος 20 ημ. ${f1(now.ma)}) · πλήθος ${now.crowd?'<b class="dn">φορτωμένο long</b>':"όχι φορτωμένο"} (L/S ${fin(now.ls)?now.ls.toFixed(2).replace(".",","):"—"}, top ${fin(now.tt)?now.tt.toFixed(2).replace(".",","):"—"}) · ξεφόρτωμα OI 72ω ${now.flush?(now.flush.turn?'<span class="up">ναι · γύρισμα #2</span>':'<span class="up">ναι</span>'):"όχι"}</div>`;
    h+=`<div class="scroll"><table><tr><th>TF</th><th>Ομάδα</th><th>Ολοκλ.</th><th>Επιτυχία</th><th>Μέσο / σήμα</th><th>Καθαρό (−${FEE} bp)</th></tr>`;
    let any=false;
    for(const tf of fx.tfs){const C=cacheOf(tf);if(!C||!C.hist)continue;any=true;const ms=msOf(tf);
      const H=C.hist.filter(x=>x.o&&fin(x.o.r));const L=H.filter(x=>x.sig>0);
      const B=[],K=[],U=[];for(const x of L){const s0=state(x.t+ms);if(!s0||!s0.ok){U.push(x);continue}(block(tf,x.sig,x.t+ms)?B:K).push(x)}
      const keep=H.filter(x=>!B.includes(x));const lab={"4h":"4H","4hm":"4H+M","1d":"1D"}[tf];
      h+=`<tr><td rowspan="4"><b>${lab}</b></td><td>Όλα τα σήματα · χωρίς διόρθωση</td>${cellS(st(H))}</tr>`+
         `<tr><td><b>Όλα τα σήματα · με διόρθωση</b></td>${cellS(st(keep))}</tr>`+
         `<tr><td>Long που μπλοκάρει</td>${cellS(st(B))}</tr>`+
         `<tr><td>Long που αφήνει</td>${cellS(st(K))}</tr>`;
      if(U.length)h+=`<tr><td></td><td colspan="5" class="sm mut">${U.length} παλιά long χωρίς δεδομένα πλήθους (η Binance κρατά ~30 μέρες L/S) — εκτός μέτρησης</td></tr>`}
    if(!any)h+=`<tr><td colspan="6" class="sm mut">Άνοιξε μία φορά το 4H, το 4H+M και το 1D για να φορτωθεί η μέτρηση.</td></tr>`;
    h+=`</table></div>`;
  }
  h+=`<p class="sm mut">«Μπλοκάρει» = σήματα που η διόρθωση θα είχε κόψει (με ό,τι ήταν γνωστό τη στιγμή του σήματος). Μόνο κλειστά σήματα. Καλό = το «Long που μπλοκάρει» να έχει αρνητικό καθαρό. Ενημέρωση ${new Date(DAT).toLocaleTimeString("el-GR",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Athens"})}.</p>`;
  el.innerHTML=h;
}
async function refresh(){if(busy)return;busy=true;try{D=await load();DAT=Date.now();err=null}catch(e){err=e.message}try{await loadTurns()}catch(e){}busy=false;render();mark()}
function loop(){
  if(Date.now()-DAT>5*60e3)refresh();
  let key="";try{key=Object.keys(CACHE).map(k=>k+":"+(CACHE[k]&&CACHE[k].at)).join("|")+"|"+curTF()+"|"+curSel()}catch(e){}
  if(key!==lastKey){lastKey=key;render()}
  mark();
}
function boot(){const app=$("app");if(!app||app.style.display==="none"||!$("shadow")){setTimeout(boot,1500);return}refresh();setInterval(loop,3e3)}
boot();
})();
