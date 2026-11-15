// TG Πρόβλεψη · «Γύρισμα αγοράς» (έρευνα 15/11/2026).
// Ανεξάρτητο κουτί: μόνο ανάγνωση Binance futures. Δεν αλλάζει το μοντέλο, τα σήματα, ούτε τα άλλα κουτιά.
// 1) Ζωντανή κατάσταση πλήθους στο BTC (funding, L/S λογαριασμών, L/S top traders, ξεφόρτωμα OI).
// 2) Σκιώδης μέτρηση: τα σήματα 4H χωρισμένα σε «με φόβο πλήθους» / «χωρίς», για να κριθεί ζωντανά το φίλτρο.
(function(){
"use strict";
const API="https://fapi.binance.com";
// Όρια = ποσοστημόρια 5% / 95% του τελευταίου έτους (15/11/2025–14/11/2026, ιστορικό Binance). Ενημέρωση κάθε μήνα.
const TH={fr_lo:-0.000038,fr_hi:0.000090,ls_lo:0.750,ls_hi:2.782,tt_lo:0.771,tt_hi:3.213,oi24_lo:-0.0401,asof:"14/11/2026"};
const H4=144e5,FEE=8,LOOK=18; // ξεφόρτωμα OI μετράει για 18 κεριά 4H (72 ώρες)
const $=id=>document.getElementById(id),fin=Number.isFinite;
const J=async u=>{const r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()};
const tA=t=>new Date(t).toLocaleString("el-GR",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Europe/Athens"});
const f2=(v,d=2)=>fin(v)?v.toFixed(d).replace(".",","):"—";
const frp=v=>fin(v)?(v>=0?"+":"−")+Math.abs(v*100).toFixed(4).replace(".",",")+"%":"—";
const pc=v=>fin(v)?(v>=0?"+":"−")+Math.abs(v*100).toFixed(1).replace(".",",")+"%":"—";
const LSK="tgturn_flags_v1";
let FL={};try{FL=JSON.parse(localStorage.getItem(LSK)||"{}")}catch(e){FL={}}
const saveFL=()=>{try{localStorage.setItem(LSK,JSON.stringify(FL))}catch(e){}};
let D=null,DAT=0,busy=false,err=null,lastN=-1;

async function load(){
  const [fr,ls,tt,oi,kl]=await Promise.all([
    J(`${API}/fapi/v1/fundingRate?symbol=BTCUSDT&limit=200`),
    J(`${API}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=4h&limit=200`),
    J(`${API}/futures/data/topLongShortAccountRatio?symbol=BTCUSDT&period=4h&limit=200`),
    J(`${API}/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=200`),
    J(`${API}/fapi/v1/klines?symbol=BTCUSDT&interval=4h&limit=300`)]);
  const s=a=>a.sort((x,y)=>x[0]-y[0]);
  return{fr:s(fr.map(x=>[+x.fundingTime,+x.fundingRate])),
    ls:s(ls.map(x=>[+x.timestamp,+x.longShortRatio])),
    tt:s(tt.map(x=>[+x.timestamp,+x.longShortRatio])),
    oi:s(oi.map(x=>[+x.timestamp,+x.sumOpenInterest])),
    px:s(kl.map(k=>[+k[0]+H4,+k[4]]))}; // [ώρα κλεισίματος, κλείσιμο]
}
function at(a,T){let v=null;for(const x of a){if(x[0]<=T)v=x;else break}return v}
function state(T){
  const f=D.fr.filter(x=>x[0]<=T).slice(-9);
  const fr3=f.length>=6?f.reduce((s,x)=>s+x[1],0)/f.length:NaN;
  // μόνο σημεία με χρόνο αυστηρά πριν από το σήμα (ό,τι ήταν γνωστό τότε)
  const ls=at(D.ls,T-1),tt=at(D.tt,T-1);
  const lsv=ls&&T-ls[0]<=2*H4?ls[1]:NaN,ttv=tt&&T-tt[0]<=2*H4?tt[1]:NaN;
  let flush=null;
  for(const o of D.oi){
    if(o[0]>=T||o[0]<T-LOOK*H4)continue;
    const o0=at(D.oi,o[0]-6*H4),p1=at(D.px,o[0]),p0=at(D.px,o[0]-6*H4);
    if(!o0||!p1||!p0||o[0]-6*H4-o0[0]>H4)continue;
    const d=Math.log(o[1]/o0[1]),dp=Math.log(p1[1]/p0[1]);
    if(d<=TH.oi24_lo&&dp<0)flush={t:o[0],d,dp};
  }
  const ok=fin(fr3)&&fin(lsv)&&fin(ttv)&&D.oi.length&&D.oi[0][0]<=T-LOOK*H4;
  const fear={fr:fr3<=TH.fr_lo,ls:lsv<=TH.ls_lo,tt:ttv<=TH.tt_lo,oi:!!flush};
  const crowd={fr:fr3>=TH.fr_hi,ls:lsv>=TH.ls_hi,tt:ttv>=TH.tt_hi};
  return{T,fr3,ls:lsv,tt:ttv,flush,ok,fear,crowd,anyFear:fear.fr||fear.ls||fear.tt||fear.oi,anyCrowd:crowd.fr||crowd.ls||crowd.tt};
}

function card(){
  let el=$("turn");if(el)return el;
  const sh=$("shadow");if(!sh)return null;
  const c=document.createElement("div");c.className="card";
  c.innerHTML=`<div class="h">Γύρισμα αγοράς · κατάσταση πλήθους (BTC)</div><div id="turn"><p class="mut sm">Φόρτωση…</p></div>`;
  sh.closest(".card").after(c);return $("turn");
}
const tick=(b,yes,no)=>b?`<b class="up">${yes}</b>`:`<span class="mut">${no}</span>`;

function stats(X){
  const n=X.length;if(!n)return{n:0};
  let w=0,s=0;for(const h of X){const bp=h.sig*h.o.r*1e4;s+=bp;if(bp>0)w++}
  return{n,win:w/n,avg:s/n,net:s-FEE*n};
}
function shadowPart(){
  const C=(typeof CACHE!=="undefined")&&CACHE["4h"];
  if(!C||!C.hist)return `<p class="sm mut">Η σκιώδης μέτρηση εμφανίζεται όταν φορτωθεί το 4H (άνοιξε μία φορά το 4H).</p>`;
  let changed=false,nodata=0;
  for(const h of C.hist){
    const key=h.s+"|"+h.t;if(FL[key])continue;
    const st=state(h.t+H4);
    if(!st.ok){nodata++;continue}
    FL[key]={f:st.anyFear?1:0,c:st.anyCrowd?1:0};changed=true;
  }
  if(changed)saveFL();
  const H=C.hist.filter(h=>h.o&&FL[h.s+"|"+h.t]);
  const g=(dir,f)=>H.filter(h=>h.sig===dir&&FL[h.s+"|"+h.t].f===f);
  const row=(lab,X)=>{const T=stats(X);return `<tr><td>${lab}</td><td>${T.n}</td><td>${T.n?Math.round(T.win*100)+"%":"—"}</td><td class="${T.n&&T.avg>=0?"up":"dn"}">${T.n?f2(T.avg,1)+" bp":"—"}</td><td class="${T.n&&T.net>=0?"up":"dn"}">${T.n?Math.round(T.net)+" bp":"—"}</td></tr>`};
  return `<div class="h" style="margin-top:12px">Σκιώδης μέτρηση 4H · σήματα με / χωρίς φόβο πλήθους</div>
  <div class="scroll"><table><tr><th>Ομάδα (κανόνας β)</th><th>Ολοκλ.</th><th>Επιτυχία</th><th>Μέσο / σήμα</th><th>Καθαρό (−${FEE} bp)</th></tr>
  ${row("Πωλήσεις <b>με</b> φόβο πλήθους",g(-1,1))}${row("Πωλήσεις χωρίς φόβο",g(-1,0))}${row("Αγορές <b>με</b> φόβο πλήθους",g(1,1))}${row("Αγορές χωρίς φόβο",g(1,0))}</table></div>
  <p class="sm mut">Το «φόβος» γράφεται τη στιγμή του σήματος και μένει αποθηκευμένο σε αυτή τη συσκευή. Τα σήματα δεν αλλάζουν: μετράμε αν οι πωλήσεις σε φόβο χάνουν, πριν γίνει κανόνας. ${nodata?nodata+" σήματα χωρίς δεδομένα (παλιότερα από 30 μέρες ή κενό στη Binance).":""} Λίγα δείγματα ανά ομάδα → κανένα συμπέρασμα πριν από ~30 ανά ομάδα.</p>`;
}

function render(){
  const el=card();if(!el)return;
  if(err&&!D){el.innerHTML=`<p class="dn sm">Σφάλμα δεδομένων: ${err}</p>`;return}
  if(!D)return;
  const st=state(Date.now());
  const head=st.anyFear?`<div class="v up">⚠️ ΦΟΒΟΣ ΠΛΗΘΟΥΣ · πιθανό γύρισμα ↑ · προσοχή στις πωλήσεις</div>`
    :st.anyCrowd?`<div class="v dn">Πλήθος φορτωμένο long · κανένα σήμα γυρίσματος ↑</div>`
    :`<div class="v">Ουδέτερο · κανένα σήμα γυρίσματος</div>`;
  el.innerHTML=`${head}
  <div class="scroll" style="margin-top:8px"><table><tr><th>Δείκτης</th><th>Τώρα</th><th>Φόβος αν</th><th>Ένδειξη</th></tr>
  <tr><td>Funding (μ.ό. 3 ημερών)</td><td>${frp(st.fr3)}</td><td>≤ ${frp(TH.fr_lo)}</td><td>${tick(st.fear.fr,"ΦΟΒΟΣ",st.crowd.fr?"φορτωμένο long":"—")}</td></tr>
  <tr><td>L/S λογαριασμών</td><td>${f2(st.ls)}</td><td>≤ ${f2(TH.ls_lo)}</td><td>${tick(st.fear.ls,"ΦΟΒΟΣ",st.crowd.ls?"φορτωμένο long":"—")}</td></tr>
  <tr><td>L/S top traders</td><td>${f2(st.tt)}</td><td>≤ ${f2(TH.tt_lo)}</td><td>${tick(st.fear.tt,"ΦΟΒΟΣ",st.crowd.tt?"φορτωμένο long":"—")}</td></tr>
  <tr><td>Ξεφόρτωμα OI (24ω ≤ ${pc(TH.oi24_lo)} με πτώση τιμής, τελευταίες 72ω)</td><td>${st.flush?tA(st.flush.t)+" · OI "+pc(st.flush.d):"όχι"}</td><td>ναι</td><td>${tick(st.fear.oi,"ΦΟΒΟΣ","—")}</td></tr>
  </table></div>
  <p class="sm mut">Από έρευνα 2020–2026 στο BTC 4H: σε φόβο πλήθους οι επόμενες 72 ώρες ήταν ιστορικά πιο ανοδικές από το κανονικό (+36 έως +200 bp, επιβεβαιωμένο εκτός δείγματος 2024–26). Το «φορτωμένο long» δεν έδωσε σταθερό σήμα πτώσης. Όρια: ποσοστημόρια 5%/95% του έτους έως ${TH.asof}. Ενημέρωση ${tA(DAT)}.</p>
  ${shadowPart()}`;
}

async function refresh(){
  if(busy)return;busy=true;
  try{D=await load();DAT=Date.now();err=null}catch(e){err=e.message}
  busy=false;render();
}
function loop(){
  const C=(typeof CACHE!=="undefined")&&CACHE["4h"];const n=C&&C.hist?C.hist.length:0;
  if(!$("turn")&&$("shadow"))render();
  if(D&&n!==lastN){lastN=n;render()}
  if(Date.now()-DAT>5*60e3)refresh();
}
function boot(){const app=document.getElementById("app");if(!app||app.style.display==="none"||!$("shadow")){setTimeout(boot,1500);return}refresh();setInterval(loop,30e3)}
boot();
})();
