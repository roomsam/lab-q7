// TG Πρόβλεψη · «Checklist Open Interest» (από τον οδηγό του Trading Gym).
// Ανεξάρτητο κουτί: μόνο ανάγνωση Binance futures. Δεν αλλάζει το μοντέλο, το φόρτωμα, ούτε τα άλλα κουτιά.
(function(){
"use strict";
const API="https://fapi.binance.com";
const SY=["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","BNBUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT","LINKUSDT","SUIUSDT","LTCUSDT","HYPEUSDT","AAVEUSDT","BCHUSDT","DOTUSDT","NEARUSDT","PUMPUSDT","RUNEUSDT","TONUSDT","TRXUSDT","XMRUSDT","ZECUSDT","XAUUSDT","QQQUSDT","SPYUSDT"];
const TRAD=new Set(["XAUUSDT","QQQUSDT","SPYUSDT"]);
const NM={XAUUSDT:"Χρυσός",QQQUSDT:"Nasdaq",SPYUSDT:"S&P 500"};const nm=s=>NM[s]||s.replace("USDT","");
const $=id=>document.getElementById(id),fin=Number.isFinite;
const J=async u=>{const r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()};
const pc=v=>!fin(v)?"—":(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(Math.abs(v)>=10?1:2).replace(".",",")+"%";
const fr=v=>!fin(v)?"—":(v>0?"+":v<0?"−":"")+Math.abs(v*100).toFixed(4).replace(".",",")+"%";
const tA=t=>new Date(t).toLocaleTimeString("el-GR",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Europe/Athens"});
const med=a=>{const b=a.filter(fin).sort((x,y)=>x-y);if(!b.length)return NaN;const m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
const AMB="#f59e0b";
const OK=`<b class="up">✓</b>`,WARN=`<b style="color:${AMB}">⚠</b>`,BAD=`<b class="dn">✗</b>`,INFO=`<b class="mut">•</b>`;
const N=4; // «το διάστημά μου» = τα τελευταία 4 κλειστά κεριά του πλαισίου
const TFS=[["1h","1H"],["4h","4H"]];
const S={sym:"BTCUSDT",d:{},T:0,err:null,at:0,busy:false};
try{const v=localStorage.getItem("tgchk_sym");if(v&&SY.includes(v))S.sym=v}catch(e){}

// ---------- δεδομένα ----------
async function load(sym){
  const out={sym,tf:{}};
  const [d1,prem,fund]=await Promise.all([
    J(`${API}/fapi/v1/klines?symbol=${sym}&interval=1d&limit=40`),
    J(`${API}/fapi/v1/premiumIndex?symbol=${sym}`).catch(()=>null),
    J(`${API}/fapi/v1/fundingRate?symbol=${sym}&limit=21`).catch(()=>[])]);
  out.d1=d1.slice(0,-1).map(b=>+b[4]);out.last=+d1[d1.length-1][4];
  out.fundNow=prem?+prem.lastFundingRate:NaN;out.fund7=fund.length?fund.reduce((a,x)=>a+(+x.fundingRate),0)/fund.length:NaN;
  await Promise.all(TFS.map(async([iv])=>{
    const [k,oi]=await Promise.all([J(`${API}/fapi/v1/klines?symbol=${sym}&interval=${iv}&limit=121`),
      J(`${API}/futures/data/openInterestHist?symbol=${sym}&period=${iv}&limit=${iv==="4h"?180:121}`).catch(()=>[])]);
    out.tf[iv]={k:k.slice(0,-1).map(b=>({t:+b[0],c:+b[4],q:+b[7]})),oi:oi.map(x=>({t:+x.timestamp,v:+x.sumOpenInterest}))}}));
  return out}

// ---------- απαντήσεις ----------
function trend(d){const c=d.d1;if(c.length<25)return{ic:INFO,txt:"λίγα δεδομένα"};
  const sma=n=>c.slice(-n).reduce((a,x)=>a+x,0)/n,s20=sma(20),s20p=c.slice(-25,-5).reduce((a,x)=>a+x,0)/20,last=c[c.length-1];
  if(last>s20&&s20>s20p)return{ic:OK,txt:`<span class="up">Ανοδική</span> · κλείσιμο πάνω από τον μέσο 20 ημερών, που ανεβαίνει`};
  if(last<s20&&s20<s20p)return{ic:OK,txt:`<span class="dn">Πτωτική</span> · κλείσιμο κάτω από τον μέσο 20 ημερών, που πέφτει`};
  return{ic:WARN,txt:"Χωρίς καθαρή τάση · τιμή και μέσος 20 ημερών δεν συμφωνούν"}}
function frame(x){if(!x||x.k.length<N+1)return null;const k=x.k,a=k[k.length-1-N],b=k[k.length-1];
  const dp=(b.c/a.c-1)*100;
  // OI στο κλείσιμο του κεριού: η εγγραφή με timestamp ≤ τέλος κεριού
  const oiAt=t=>{let v=NaN;for(const o of x.oi){if(o.t<=t)v=o.v;else break}return v};
  const step=k.length>1?k[1].t-k[0].t:3600e3;
  const o0=oiAt(a.t+step),o1=oiAt(b.t+step),doi=(o1/o0-1)*100;
  const sums=[];for(let i=N;i<=k.length;i++)sums.push(k.slice(i-N,i).reduce((s,y)=>s+y.q,0));
  const vr=sums[sums.length-1]/med(sums.slice(0,-1));
  return{dp,doi,vr,from:a.t+step,to:b.t+step}}
function quad(f){if(!f||!fin(f.doi))return{ic:INFO,txt:"—"};
  const pf=Math.abs(f.dp)<0.15,of=Math.abs(f.doi)<0.3;
  if(pf&&of)return{ic:BAD,txt:"Τίποτα καθαρό · τιμή και OI σχεδόν σταθερά"};
  if(of)return{ic:WARN,txt:(f.dp>0?"Τιμή ↑":"Τιμή ↓")+" με OI σταθερό · αλλαγή χεριών, όχι νέα χρήματα"};
  if(pf)return{ic:WARN,txt:(f.doi>0?"OI ↑ με τιμή σταθερή · χτίζονται θέσεις, κατεύθυνση άγνωστη":"OI ↓ με τιμή σταθερή · κλείνουν θέσεις")};
  if(f.dp>0&&f.doi>0)return{ic:OK,txt:`<span class="up">Νέα longs</span> · μπαίνουν νέα χρήματα στην άνοδο`};
  if(f.dp>0&&f.doi<0)return{ic:WARN,txt:`<span class="up">Κάλυψη shorts</span> · καύσιμο που τελειώνει, συχνά βραχύβιο`};
  if(f.dp<0&&f.doi>0)return{ic:OK,txt:`<span class="dn">Νέα shorts</span> · νέες θέσεις στην πτώση, ρίσκο ντόμινο`};
  return{ic:WARN,txt:`<span class="dn">Καθάρισμα longs</span> · κλείνουν longs, δες αν τελείωσε`}}
function vol(f){if(!f||!fin(f.vr))return{ic:INFO,txt:"—"};const v=f.vr.toFixed(1).replace(".",",")+"×";
  if(f.vr>=1.5)return{ic:OK,txt:`${v} του κανονικού · συμμετοχή`};
  if(f.vr>=0.7)return{ic:WARN,txt:`${v} · κανονικός όγκος`};
  return{ic:BAD,txt:`${v} · αδιαφορία, η κίνηση δεν έχει κόσμο`}}
function fund(d){const n=d.fundNow,a=d.fund7;if(!fin(n))return{ic:INFO,txt:"—"};
  const side=n>0.00015?"πολλοί long πληρώνουν":n<-0.00005?"πολλοί short πληρώνουν":"ισορροπία";
  const ic=(n>=0.0003||n<=-0.0001)?BAD:(n>0.00015||n<0)?WARN:OK;
  return{ic,txt:`Τώρα ${fr(n)} · μέσος 7 ημερών ${fr(a)} · ${side} (κανονικό 0,0100%)`}}
function oiHigh(d){const x=d.tf["4h"];if(!x||x.oi.length<30)return{ic:INFO,txt:"—"};const v=x.oi.map(o=>o.v),cur=v[v.length-1];
  const p=Math.round(v.filter(y=>y<=cur).length/v.length*100);const days=Math.round(v.length*4/24);
  if(p>=90)return{ic:BAD,txt:`Ποσοστημόριο ${p}% των ${days} ημερών · φορτωμένο σύστημα`};
  if(p>=75)return{ic:WARN,txt:`Ποσοστημόριο ${p}% των ${days} ημερών · ψηλά`};
  return{ic:OK,txt:`Ποσοστημόριο ${p}% των ${days} ημερών · όχι ακραίο`}}
function who(d){const f4=frame(d.tf["4h"]),f1=frame(d.tf["1h"]);if(!f4)return"";
  const q=x=>{if(!x||!fin(x.doi))return"";const pf=Math.abs(x.dp)<0.15,of=Math.abs(x.doi)<0.3;if(pf&&of)return"τίποτα καθαρό";if(of)return"αλλαγή χεριών";if(pf)return x.doi>0?"χτίζονται θέσεις":"κλείνουν θέσεις";
    return x.dp>0?(x.doi>0?"νέα longs":"κάλυψη shorts"):(x.doi>0?"νέα shorts":"καθάρισμα longs")};
  const n=d.fundNow;let s=`4H: <b>${q(f4)}</b> · 1H: <b>${q(f1)}</b>`;
  const a4=q(f4);
  if(a4==="νέα shorts"&&n>0.0001)s+=" · τιμή ↓ με νέα shorts ενώ το funding μένει θετικό: οι long δεν έχουν βγει ακόμα, ρίσκο ντόμινο.";
  else if(a4==="νέα longs"&&n>=0.0003)s+=" · άνοδος με δανεικά (funding ψηλό): εύθραυστη.";
  else if(a4==="καθάρισμα longs"&&n<=0)s+=" · OI πέφτει και το funding έγινε ουδέτερο/αρνητικό: πιθανό καθάρισμα που ολοκληρώνεται.";
  else if(a4==="κάλυψη shorts")s+=" · η άνοδος τροφοδοτείται από shorts που κλείνουν· περίμενε νέα longs (OI ↑) για επιβεβαίωση.";
  else s+=".";
  if(["νέα longs","κάλυψη shorts","νέα shorts","καθάρισμα longs"].includes(q(f1))&&["νέα longs","κάλυψη shorts","νέα shorts","καθάρισμα longs"].includes(a4)&&q(f1)!==a4)s+=" Τα δύο πλαίσια λένε διαφορετική ιστορία: η πιο πρόσφατη (1H) μπορεί να είναι αλλαγή φάσης.";
  return s}

// ---------- εμφάνιση ----------
function manKey(){return "tgchk_m_"+S.sym}
function manGet(){try{const o=JSON.parse(localStorage.getItem(manKey())||"null");if(o&&Date.now()-o.t<12*3600e3)return o;}catch(e){}return{t:Date.now(),v:{}}}
function manSet(k,v){try{const o=manGet();o.v[k]=v;o.t=Date.now();localStorage.setItem(manKey(),JSON.stringify(o))}catch(e){}}
function render(){const b=$("ckBody");if(!b)return;const d=S.d[S.sym];
  const opts=SY.map(s=>`<option value="${s}"${s===S.sym?" selected":""}>${nm(s)}</option>`).join("");
  const head=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><label class="sm mut">Σύμβολο</label><select id="ckSym" style="background:#0f172a;color:#e5e7eb;border:1px solid #334155;border-radius:8px;padding:5px 8px">${opts}</select>${TRAD.has(S.sym)?`<span class="sm mut">token του Binance · δείγμα λιανικής, όχι COMEX/CME</span>`:""}</div>`;
  if(!d){b.innerHTML=head+`<p class="sm mut">${S.err?"Σφάλμα: "+S.err:"Φόρτωση…"}</p>`;bind();return}
  const f={};TFS.forEach(([iv])=>f[iv]=frame(d.tf[iv]));
  const two=(fn)=>TFS.map(([iv,lb])=>{const r=fn(f[iv]);return`<div><span class="sm mut" style="display:inline-block;width:26px">${lb}</span> ${r.ic} ${r.txt}</div>`}).join("");
  const arrow=(v,thr)=>!fin(v)?"—":`<span class="${Math.abs(v)<thr?"mut":v>0?"up":"dn"}">${v>0?"↑":v<0?"↓":"→"} ${pc(v)}</span>`;
  const t1=trend(d),t6=fund(d),t7=oiHigh(d);const m=manGet().v;
  const RS="display:grid;grid-template-columns:30px minmax(150px,32%) 1fr;gap:10px;padding:9px 2px;border-top:1px solid rgba(148,163,184,.15);align-items:start;text-align:left;font-size:14px;line-height:1.45";
  const row=(n,q,ans)=>`<div style="${RS}"><div style="color:#3b82f6;font-weight:700">${n}.</div><div>${q}</div><div>${ans}</div></div>`;
  const man=(n,q,hint)=>`<div style="${RS}"><div style="color:#3b82f6;font-weight:700">${n}.</div><div>${q}</div><label style="cursor:pointer;display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-ck="${n}"${m[n]?" checked":""} style="transform:scale(1.25);margin-top:4px;accent-color:#3b82f6;flex:none"><span class="${m[n]?"up":"mut"}">${hint}</span></label></div>`;
  const ok=[t1,t6,t7,...TFS.map(([iv])=>quad(f[iv])),...TFS.map(([iv])=>vol(f[iv]))];
  const nb=ok.filter(r=>r.ic===BAD).length,nw=ok.filter(r=>r.ic===WARN).length,mc=[8,9,10].filter(k=>m[k]).length;
  b.innerHTML=head+`<div>
    ${row(1,"Ποια είναι η μεγάλη τάση; (ημερήσιο)",`<div>${t1.ic} ${t1.txt}</div>`)}
    ${row(2,"Τι έκανε η τιμή στο διάστημά μου;",TFS.map(([iv,lb])=>`<div><span class="sm mut" style="display:inline-block;width:26px">${lb}</span> ${INFO} ${arrow(f[iv]&&f[iv].dp,0.15)}</div>`).join(""))}
    ${row(3,"Τι έκανε το OI σε ΝΟΜΙΣΜΑΤΑ;",TFS.map(([iv,lb])=>`<div><span class="sm mut" style="display:inline-block;width:26px">${lb}</span> ${INFO} ${arrow(f[iv]&&f[iv].doi,0.3)}</div>`).join(""))}
    ${row(4,"Σε ποιο από τα 4 κουτιά είμαστε;",two(quad))}
    ${row(5,"Ο όγκος δείχνει συμμετοχή;",two(vol))}
    ${row(6,"Funding: κοντά στο 0,01% ή ακραίο;",`<div>${t6.ic} ${t6.txt}</div>`)}
    ${row(7,"Το OI είναι σε ακραίο ύψος;",`<div>${t7.ic} ${t7.txt}</div>`)}
    ${man(8,"Πού είναι οι ζώνες ρευστοποιήσεων;","Τις κοίταξα (CoinGlass heatmap) και ξέρω την απόσταση σε %")}
    ${man(9,"Έρχεται είδηση; (CPI, Fed, NFP)","Έλεγξα το ημερολόγιο · δεν είμαι σε παράθυρο αποχής")}
    ${man(10,"Ποια είναι η ακύρωσή μου; (πριν μπω)","Την έγραψα πριν μπω")}
  </div>
  <div style="margin-top:12px;padding:10px 12px;border:1px solid ${AMB};border-radius:10px;background:rgba(245,158,11,.07)">
    <div class="sm" style="color:${AMB};font-weight:700;margin-bottom:4px">Ποιος κινεί την τιμή και γιατί;</div>
    <div style="font-size:14px;line-height:1.45">${who(d)}</div>
    <div class="sm mut" style="margin-top:6px">Προειδοποιήσεις: ${nb} ✗ · ${nw} ⚠ · χειροκίνητα ${mc}/3 τσεκαρισμένα</div></div>
  <p class="sm mut" style="margin:12px 0 0">«Διάστημά μου» = τα τελευταία ${N} κλειστά κεριά του 1H (${N} ώρες) και του 4H (${N*4} ώρες). OI σε νομίσματα, Binance futures (δείγμα, όχι όλη η αγορά). Όρια: τιμή σταθερή αν |Δ| &lt; 0,15%, OI σταθερό αν |Δ| &lt; 0,3%· όγκος = άθροισμα ${N} κεριών έναντι του διάμεσου των τελευταίων 120· funding ακραίο από 0,03% και πάνω ή κάτω από −0,01%· OI ακραίο από ποσοστημόριο 90% των 30 ημερών. Τα όρια είναι αρχικά, χωρίς μέτρηση. Τα κουτάκια 8–10 τα τσεκάρεις εσύ και μένουν 12 ώρες ανά σύμβολο. Ανάγνωση, όχι σήμα· δεν μπαίνει στο μοντέλο.${S.at?" · ενημέρωση "+tA(S.at):""}</p>`;
  {const a=$("ckAt");if(a&&S.at)a.textContent="· "+tA(S.at)}
  bind()}
function bind(){const sel=$("ckSym");if(sel&&!sel._b){sel._b=1;sel.onchange=()=>{S.sym=sel.value;try{localStorage.setItem("tgchk_sym",S.sym)}catch(e){}render();refresh(true)}}
  document.querySelectorAll("#ckBody input[data-ck]").forEach(i=>{if(i._b)return;i._b=1;i.onchange=()=>{manSet(i.dataset.ck,i.checked);render()}})}
async function refresh(force){if(S.busy)return;const sym=S.sym;if(!force&&S.d[sym]&&Date.now()-S.d[sym]._t<60e3)return;
  S.busy=true;try{const d=await load(sym);d._t=Date.now();S.d[sym]=d;S.at=Date.now();S.err=null}catch(e){S.err=e.message}S.busy=false;if(sym===S.sym)render()}

// ---------- σκελετός ----------
function build(){const after=$("vlCard")||$("smCard"),nav=$("tgNav");const c=document.createElement("div");c.className="card tgx";c.id="ckCard";c.dataset.tab="sum";
  const on=nav&&nav.querySelector("button.on");if(on&&on.dataset.k!=="sum")c.classList.add("tgHide");
  c.innerHTML=`<div class="ldTop"><div class="ldTitle">✅ Checklist <b>Open Interest</b></div><span class="ldLive"><i></i>ΖΩΝΤΑΝΟ <span id="ckAt"></span></span></div><div id="ckBody"><p class="sm mut">Φόρτωση…</p></div>`;
  after.insertAdjacentElement("afterend",c)}
async function boot(){const app=$("app");if(!app||app.style.display==="none"||!$("smCard")||!$("tgNav")){setTimeout(boot,900);return}
  if(!$("vlCard")&&!boot._w){boot._w=1;setTimeout(boot,2500);return}
  build();render();refresh(true);
  setInterval(()=>{if(!document.hidden)refresh(false)},15e3);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh(false)})}
window.TGC={S,load,frame};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
