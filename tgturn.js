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
const RSK="tgturn_run_v1";
let RN={};try{RN=JSON.parse(localStorage.getItem(RSK)||"{}")}catch(e){RN={}}
const saveRN=()=>{try{localStorage.setItem(RSK,JSON.stringify(RN))}catch(e){}};
const MAXN=12,BASEN=6; // έξοδος σε κούραση: έως 12 κεριά 4H· αν δεν πιάσει 1R μέσα σε 6, κλείνει όπως τώρα
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

// Σκιώδης έξοδος «μισό στο 1R + το υπόλοιπο τρέχει μέχρι κούραση». Μόνο μέτρηση· δεν αλλάζει σήματα/εξόδους της σελίδας.
// Φάση 1: stop −1 ATR / στόχος +1 ATR (αν χτυπηθούν και τα δύο στο ίδιο κερί → stop, όπως η σελίδα). Χωρίς 1R μέσα σε 6 κεριά → κλείσιμο όπως τώρα.
// Φάση 2 (μισό έκλεισε στο +1R): stop στην είσοδο· έξοδος στο κλείσιμο κεριού όταν (α) η τιμή γυρίσει 1 ATR από το καλύτερο κλείσιμο,
// (β) σε πωλήσεις: εμφανιστεί «φόβος πλήθους», (γ) φτάσει 12 κεριά.
function runner(h,A){
  const i=A.idx.get(h.t);if(i==null)return null;const b=A.b,c0=h.c,a=h.atr,sg=h.sig;
  if(!fin(c0)||!fin(a)||a<=0)return null;
  const stop=c0-sg*a,tp=c0+sg*a;let ph=1,best=tp;
  for(let j=1;j<=MAXN;j++){
    const k=i+j;if(k>=b.t.length)return null;
    const hi=b.h[k],lo=b.l[k],cl=b.c[k],T=b.t[k]+H4;
    if(ph===1){
      const adv=sg>0?lo<=stop:hi>=stop,fav=sg>0?hi>=tp:lo<=tp;
      if(adv)return{r:-a/c0,how:"stop",n:j};
      if(fav){ph=2;best=sg>0?Math.max(tp,cl):Math.min(tp,cl);continue}
      if(j===BASEN)return{r:sg*Math.log(cl/c0),how:"λήξη",n:j};
      continue;
    }
    const be=sg>0?lo<=c0:hi>=c0;
    if(be)return{r:0.5*a/c0,how:"1R+είσοδος",n:j};
    best=sg>0?Math.max(best,cl):Math.min(best,cl);
    const run=sg*Math.log(cl/c0);
    if(sg*(best-cl)>=a)return{r:0.5*a/c0+0.5*run,how:"γύρισε 1 ATR",n:j};
    if(sg<0&&D){const st=state(T);if(st.anyFear)return{r:0.5*a/c0+0.5*run,how:"φόβος πλήθους",n:j}}
    if(j===MAXN)return{r:0.5*a/c0+0.5*run,how:"12 κεριά",n:j};
  }
  return null;
}
function comparePart(C){
  const rows=[];let changed=false;
  for(const h of C.hist){
    const key=h.s+"|"+h.t,f=FL[key];if(!f||!h.o||!fin(h.o.r))continue;
    let rr=RN[key];
    if(!rr){const A=C.all&&C.all[h.s];if(!A)continue;const x=runner(h,A);if(!x)continue;rr=RN[key]={r:x.r,how:x.how,n:x.n};changed=true}
    rows.push({sig:h.sig,f:f.f,base:h.sig*h.o.r*1e4,run:rr.r*1e4});
  }
  if(changed)saveRN();
  const st=(X,k)=>{const n=X.length;if(!n)return{n:0};let w=0,s=0;for(const x of X){s+=x[k];if(x[k]>0)w++}return{n,win:w/n,avg:s/n,net:s-FEE*n}};
  const filt=rows.filter(x=>!(x.sig<0&&x.f===1));
  const row=(lab,X,k,note)=>{const T=st(X,k);return `<tr><td>${lab}<br><span class="sm mut">${note}</span></td><td>${T.n}</td><td>${T.n?Math.round(T.win*100)+"%":"—"}</td><td class="${T.n&&T.avg>=0?"up":"dn"}">${T.n?f2(T.avg,1)+" bp":"—"}</td><td class="${T.n&&T.net>=0?"up":"dn"}">${T.n?Math.round(T.net)+" bp":"—"}</td></tr>`};
  const how={};for(const k in RN){const v=RN[k];how[v.how]=(how[v.how]||0)+1}
  return `<div class="h" style="margin-top:12px">Σύγκριση αλλαγών · ίδια σήματα 4H · μέτρηση έως 30/11</div>
  <div class="scroll"><table><tr><th>Παραλλαγή</th><th>Ολοκλ.</th><th>Επιτυχία</th><th>Μέσο / σήμα</th><th>Καθαρό (−${FEE} bp)</th></tr>
  ${row("Α · όπως τώρα",rows,"base","1:1 · λήξη 6 κεριά · όλα τα σήματα")}
  ${row("Β · φίλτρο φόβου",filt,"base","όχι πωλήσεις σε φόβο πλήθους")}
  ${row("Γ · έξοδος σε κούραση",rows,"run","μισό στο 1R, το υπόλοιπο τρέχει (έως 12 κεριά)")}
  ${row("Δ · φίλτρο + κούραση",filt,"run","Β και Γ μαζί")}</table></div>
  <p class="sm mut">Πώς έκλεισε η Γ: ${Object.entries(how).map(([k,v])=>k+" "+v).join(" · ")||"—"}. Μετράει μόνο κλειστά σήματα, από τα κεριά 4H της σελίδας (όπου στο ίδιο κερί χτυπάνε και στόχος και stop, μετράει stop). Η απόφαση στις 30/11 με βάση το «Καθαρό».</p>`;
}

// ---------- Έλεγχος κανόνων εισόδου/εξόδου (μόνο μέτρηση) ----------
// Γενική προσομοίωση: είσοδος e, stop/στόχος σε απόσταση sd/td, έλεγχος κεριών από j0 έως i+6, ίδιο κερί → stop, λήξη στο κλείσιμο του 6ου.
function sim(b,i,sg,e,sd,td,j0){
  for(let j=j0;j<=BASEN;j++){const k=i+j;if(k>=b.t.length)return null;
    const adv=sg>0?b.l[k]<=e-sd:b.h[k]>=e+sd,fav=sg>0?b.h[k]>=e+td:b.l[k]<=e-td;
    if(adv)return -sd/e;if(fav)return td/e;}
  const k=i+BASEN;if(k>=b.t.length)return null;return sg*Math.log(b.c[k]/e);
}
function rulesPart(C){
  const R={A:[],E:[],Z:[]},cal={};let zs=[];
  for(const h of C.hist){
    if(!h.o||!fin(h.o.r))continue;const A=C.all&&C.all[h.s];if(!A)continue;const i=A.idx.get(h.t);if(i==null)continue;
    const b=A.b,a=h.atr,sg=h.sig,c0=h.c;if(!fin(a)||a<=0)continue;
    const base=sg*h.o.r*1e4;
    // Ε: είσοδος στο άνοιγμα του επόμενου κεριού (όπως οι ειδοποιήσεις), ίδιες αποστάσεις 1 ATR
    let rE=null;if(b.o&&i+1<b.t.length&&fin(b.o[i+1]))rE=sim(b,i,sg,b.o[i+1],a,a,1);
    // Ζ: stop πίσω από το swing των 5 τελευταίων κεριών (+0,1 ATR), όριο 0,5–2 ATR, στόχος ίση απόσταση (1:1)
    let lo=Infinity,hi=-Infinity;for(let k=Math.max(0,i-4);k<=i;k++){lo=Math.min(lo,b.l[k]);hi=Math.max(hi,b.h[k])}
    let sd=sg>0?c0-lo+0.1*a:hi-c0+0.1*a;sd=Math.min(2*a,Math.max(0.5*a,sd));zs.push(sd/a);
    const rZ=sim(b,i,sg,c0,sd,sd,1);
    if(rE==null||rZ==null)continue;
    R.A.push(base);R.E.push(rE*1e4);R.Z.push(rZ*1e4);
    const conf=Math.max(h.p,1-h.p),bk=conf>=0.75?"≥75%":conf>=0.70?"70–75%":"65–70%";
    (cal[bk]=cal[bk]||[]).push({bp:base,p:conf});
  }
  const st=X=>{const n=X.length;if(!n)return{n:0};let w=0,s=0;for(const x of X){s+=x;if(x>0)w++}return{n,win:w/n,avg:s/n,net:s-FEE*n}};
  const row=(lab,X,note)=>{const T=st(X);return `<tr><td>${lab}<br><span class="sm mut">${note}</span></td><td>${T.n}</td><td>${T.n?Math.round(T.win*100)+"%":"—"}</td><td class="${T.n&&T.avg>=0?"up":"dn"}">${T.n?f2(T.avg,1)+" bp":"—"}</td><td class="${T.n&&T.net>=0?"up":"dn"}">${T.n?Math.round(T.net)+" bp":"—"}</td></tr>`};
  const medZ=zs.length?zs.slice().sort((x,y)=>x-y)[zs.length>>1]:NaN;
  const calRows=["65–70%","70–75%","≥75%"].map(k=>{const X=cal[k]||[];const n=X.length;const w=n?X.filter(x=>x.bp>0).length/n:NaN;const pm=n?X.reduce((s,x)=>s+x.p,0)/n:NaN;const av=n?X.reduce((s,x)=>s+x.bp,0)/n:NaN;
    return `<tr><td>${k}</td><td>${n}</td><td>${n?Math.round(pm*100)+"%":"—"}</td><td>${n?Math.round(w*100)+"%":"—"}</td><td class="${n&&av>=0?"up":"dn"}">${n?f2(av,1)+" bp":"—"}</td></tr>`}).join("");
  return `<div class="h" style="margin-top:12px">Έλεγχος κανόνων · ίδια σήματα 4H</div>
  <div class="scroll"><table><tr><th>Κανόνας</th><th>Ολοκλ.</th><th>Επιτυχία</th><th>Μέσο / σήμα</th><th>Καθαρό (−${FEE} bp)</th></tr>
  ${row("Α · όπως τώρα",R.A,"είσοδος στο κλείσιμο · stop/στόχος 1 ATR")}${row("Ε · είσοδος στο επόμενο άνοιγμα",R.E,"όπως εκτελείς από την ειδοποίηση")}${row("Ζ · stop πίσω από το swing",R.Z,`χαμηλό/ψηλό 5 κεριών +0,1 ATR · στόχος ίση απόσταση · διάμεσο stop ${f2(medZ,2)} ATR`)}</table></div>
  <div class="h" style="margin-top:12px">Βαθμονόμηση · λέει 65% και πιάνει 65%;</div>
  <div class="scroll"><table><tr><th>Σιγουριά μοντέλου</th><th>Σήματα</th><th>Μέση πιθ.</th><th>Πραγματική επιτυχία</th><th>Μέσο / σήμα</th></tr>${calRows}</table></div>
  <p class="sm mut">Επαναλήψεις: δες τον πίνακα «α · μία θέση ανά σύμβολο» / «β · προσθήκη θέσης» στον Σκιώδη λογαριασμό. «Επιτυχία» = σήματα με θετικό αποτέλεσμα (μαζί με τις λήξεις σε κέρδος).</p>`;
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
  <p class="sm mut">Το «φόβος» γράφεται τη στιγμή του σήματος και μένει αποθηκευμένο σε αυτή τη συσκευή. Τα σήματα δεν αλλάζουν: μετράμε αν οι πωλήσεις σε φόβο χάνουν, πριν γίνει κανόνας. ${nodata?nodata+" σήματα χωρίς δεδομένα (παλιότερα από 30 μέρες ή κενό στη Binance).":""} Λίγα δείγματα ανά ομάδα → κανένα συμπέρασμα πριν από ~30 ανά ομάδα.</p>
  ${comparePart(C)}
  ${rulesPart(C)}
  ${mPart(C)}
  ${todoPart()}`;
}

// ---------- 4H+M: αγορές / πωλήσεις + συνδυασμός «πωλήσεις 4H + αγορές 4H+M» (ιδέα 15/11, μόνο μέτρηση) ----------
const FROM15=Date.parse("2026-11-14T22:00:00Z"); // Κυρ 15/11 00:00 Ελλάδας
function mPart(C4){
  const CM=(typeof CACHE!=="undefined")&&CACHE["4hm"];
  const head=`<div class="h" style="margin-top:12px">4H+M · αγορές / πωλήσεις και συνδυασμός με το 4H</div>`;
  if(!CM||!CM.hist)return head+`<p class="sm mut">Άνοιξε μία φορά το <b>4H+M</b> (και μετά ξανά το 4H) για να φορτωθεί αυτή η μέτρηση.</p>`;
  let changed=false;
  for(const h of CM.hist){const key="m|"+h.s+"|"+h.t;if(FL[key])continue;const st=state(h.t+H4);if(!st.ok)continue;FL[key]={f:st.anyFear?1:0,c:st.anyCrowd?1:0};changed=true}
  if(changed)saveFL();
  const M=CM.hist.filter(h=>h.o&&fin(h.o.r)),F4=C4.hist.filter(h=>h.o&&fin(h.o.r));
  const fearM=h=>{const f=FL["m|"+h.s+"|"+h.t];return f?f.f===1:null};
  const mB=M.filter(h=>h.sig>0),mS=M.filter(h=>h.sig<0),new15=X=>X.filter(h=>h.t>=FROM15);
  const all=CM.hist.length,allB=CM.hist.filter(h=>h.sig>0).length;
  const row=(lab,X,note)=>{const T=stats(X);return `<tr><td>${lab}${note?`<br><span class="sm mut">${note}</span>`:""}</td><td>${T.n}</td><td>${T.n?Math.round(T.win*100)+"%":"—"}</td><td class="${T.n&&T.avg>=0?"up":"dn"}">${T.n?f2(T.avg,1)+" bp":"—"}</td><td class="${T.n&&T.net>=0?"up":"dn"}">${T.n?Math.round(T.net)+" bp":"—"}</td></tr>`};
  // συνδυασμοί (κανόνας β: κάθε σήμα = θέση)
  const s4=F4.filter(h=>h.sig<0),b4=F4.filter(h=>h.sig>0);
  const mBf=mB.filter(h=>fearM(h)===true);
  // αντικρουόμενα: αγορά 4H+M ενώ είναι ανοιχτή πώληση 4H στο ίδιο σύμβολο (στην πράξη αλληλοαναιρούνται)
  let conf=0;for(const m of mB){if(F4.some(h=>h.sig<0&&h.s===m.s&&m.t>=h.t&&m.t<h.t+h.o.n*H4))conf++}
  const th=`<tr><th>Ομάδα</th><th>Ολοκλ.</th><th>Επιτυχία</th><th>Μέσο / σήμα</th><th>Καθαρό (−${FEE} bp)</th></tr>`;
  return head+`<p class="sm">Σύνολο σημάτων 4H+M: <b>${all}</b> · αγορές <b>${allB}</b> (${all?Math.round(allB/all*100):0}%) · πωλήσεις <b>${all-allB}</b></p>
  <div class="scroll"><table>${th}
  ${row("Αγορές 4H+M · όλες",mB)}${row("Πωλήσεις 4H+M · όλες",mS)}
  ${row("Αγορές 4H+M · από 15/11",new15(mB),"μετά το γύρισμα")}${row("Πωλήσεις 4H+M · από 15/11",new15(mS))}
  ${row("Αγορές 4H+M <b>με</b> φόβο πλήθους",mBf)}${row("Αγορές 4H+M χωρίς φόβο",mB.filter(h=>fearM(h)===false))}</table></div>
  <div class="h" style="margin-top:12px">Συνδυασμός · μέτρηση έως 30/11</div>
  <div class="scroll"><table>${th}
  ${row("Α · 4H όπως τώρα",F4,"πωλήσεις + αγορές 4H")}
  ${row("Ι · μόνο πωλήσεις 4H",s4,"καμία αγορά")}
  ${row("Η · πωλήσεις 4H + αγορές 4H+M",s4.concat(mB),"η ιδέα: κάθε μοντέλο στο δυνατό του")}
  ${row("Θ · πωλήσεις 4H + αγορές 4H+M μόνο σε φόβο",s4.concat(mBf),"αγορά μόνο όταν η κάρτα δείχνει γύρισμα")}
  ${row("Από 15/11 · Η",new15(s4).concat(new15(mB)),"ίδια με Η, μόνο μετά το γύρισμα")}</table></div>
  <p class="sm mut">Αντικρουόμενα στην Η: ${conf} αγορές 4H+M άνοιξαν ενώ ήταν ανοιχτή πώληση 4H στο ίδιο σύμβολο (στην πράξη αλληλοαναιρούνται, εδώ μετριούνται και οι δύο). Κανένα σήμα δεν αλλάζει· μόνο μέτρηση.</p>`;
}
function todoPart(){
  return `<div class="h" style="margin-top:12px">Κρίνεται στις 30/11 · ευρήματα 15/11</div>
  <ul class="sm" style="margin:6px 0 0;padding-left:18px">
  <li>Αγορές 4H: 1 στις 31 μέχρι 15/11 → κρατάμε ή κόβουμε τα long;</li>
  <li>Φίλτρο φόβου (Β/Δ): μέχρι τώρα χειρότερο από το Α.</li>
  <li>Κούραση (Γ): +1,4 bp/σήμα = θόρυβος μέχρι τώρα.</li>
  <li>Επαναλήψεις (κανόνας β): 78% / +74 bp έναντι 55% / +28 bp στα πρώτα σήματα.</li>
  <li>Είσοδος (Ε) και stop 1 ATR: εντάξει, δεν αλλάζουν.</li>
  <li>Βαθμονόμηση: σωστή· τα ≥70% ~2× bp → πιθανό μεγαλύτερο μέγεθος, όχι φίλτρο.</li>
  <li>4H+M: −33.671 bp σε 287 μέχρι 15/11 → πάντα long ή ανάποδο; Συνδυασμός Η/Θ.</li>
  <li>Το 4H νικάει την τάση; «Βάση» 70% έναντι 65% του μοντέλου.</li>
  </ul>`;
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
  const C=(typeof CACHE!=="undefined")&&CACHE["4h"],CM=(typeof CACHE!=="undefined")&&CACHE["4hm"];const n=(C&&C.hist?C.hist.length:0)*1e5+(CM&&CM.hist?CM.hist.length:0);
  if(!$("turn")&&$("shadow"))render();
  if(D&&n!==lastN){lastN=n;render()}
  if(Date.now()-DAT>5*60e3)refresh();
}
function boot(){const app=document.getElementById("app");if(!app||app.style.display==="none"||!$("shadow")){setTimeout(boot,1500);return}refresh();setInterval(loop,30e3)}
boot();
})();
