// TG Φόρτωμα αγοράς — μηχανή v2. Καθαρή JS, ίδια στη σελίδα, στον notifier και στα τεστ.
// Είσοδος: D = { SYM: {t:[ms άνοιγμα 5′], o,h,l,c,qv,tbq:[...], oi:[...], top:[long share ή NaN], ret:[...], atr4:number, liqL?,liqS?:[$ ρευστοποιήσεων ανά 5′]} }
// Όλοι οι πίνακες ίδιου μήκους, ευθυγραμμισμένοι στα ίδια t. Έξοδος: ανά μπάρα καταστάσεις συμβόλων, αγοράς, επεισόδια long/short.
(function(root){
const TH={
  sym:{oi:0.003,flat:0.0015,tkAbs:0.90,liqAbs:0.0003,xfer:0.3},                // ανά σύμβολο
  load:{br:0.80,moi:0.003,tk:1.10,ext:1.5},              // 🟡 φόρτωμα (μετρημένο 2021–26)
  liq:{br:0.80,moi:-0.005,tk:1/1.10,ext:1.5},            // 🟡 φόρτωμα short = ρευστοποίηση longs (μετρημένο)
  early:{move:0.005,oi:0.001,tk:0.90,top:0.5,ret:0.4,pt:0.2},     // 🟡 πρώιμο: μετά από κίνηση ≥0,5% σε 90′, το OI σταμάτησε να φεύγει, οι takers επιμένουν, μεγάλοι αντίθετα από λιανική σε ≥50%/40% των συμβόλων
  watchMax:72,cancel:0.006,swing:12,sweepMin:0.0008,                     // παρακολούθηση ως 6ω· ακύρωση αν BTC κλείσει 0,6% κάτω από τη βάση
  exh:{near:0.0015,oiDrop:0.002,tk:1.05,minGain:0.003},  // 🔴 εξασθένηση
  end:{drop:0.003,tk:0.9},moveMax:72,                    // ❌ τέλος
};
const EXCL=new Set(["XAUUSDT"]);
const sum=(a,i,n)=>{let s=0;for(let k=i-n+1;k<=i;k++)s+=a[k]||0;return s};
const fin=x=>Number.isFinite(x);
function symStates(D,syms,j){
  const out={};
  for(const s of syms){const d=D[s];if(!d||j<6||!fin(d.c[j])||!fin(d.c[j-6]))continue;
    const r30=d.c[j]/d.c[j-6]-1,r15=d.c[j]/d.c[j-3]-1;const o1=d.oi[j],o0=d.oi[j-6];const dO=(fin(o1)&&fin(o0)&&o0>0)?o1/o0-1:NaN;
    const B=sum(d.tbq,j,6),S=sum(d.qv,j,6)-B;const tk=S>0?B/S:NaN;
    const ext=d.atr4>0&&fin(d.c[j-48])?(d.c[j]/d.c[j-48]-1)*d.c[j]/d.atr4:NaN;
    const top=fin(d.top[j])&&fin(d.top[j-6])?(d.top[j]-d.top[j-6])*100:NaN,ret=fin(d.ret[j])&&fin(d.ret[j-6])?(d.ret[j]-d.ret[j-6])*100:NaN;
    // ρευστοποιήσεις 15′ (δείγμα Binance, $) ως ποσοστό του OI· μεγάλοι/λιανική μεταβολή 4ω σε μονάδες
    const lqL=d.liqL?sum(d.liqL,j,3):NaN,lqS=d.liqS?sum(d.liqS,j,3):NaN;const lqLp=fin(lqL)&&o1>0?lqL/o1:NaN,lqSp=fin(lqS)&&o1>0?lqS/o1:NaN;
    const top4=fin(d.top[j])&&fin(d.top[j-48])?(d.top[j]-d.top[j-48])*100:NaN,ret4=fin(d.ret[j])&&fin(d.ret[j-48])?(d.ret[j]-d.ret[j-48])*100:NaN;
    let st="none";
    if(fin(dO)){const T=TH.sym;
      if(r30<=-T.flat&&dO>=T.oi)st="shorts";                 // ⚡ τιμή κάτω, ανοίγουν θέσεις
      else if(r30<=-T.flat&&dO<=-T.oi)st="liq";              // ↓ ρευστοποίηση
      else if(r30>=-T.flat&&dO>=T.oi)st="load";               // ↑ φορτώνει (τιμή επίπεδη/πάνω, OI ↑)
      else if(r30>=T.flat&&dO<=-T.oi)st="cover";              // ↑ κάλυψη (άνοδος χωρίς νέες θέσεις)
      else if(fin(lqLp)&&lqLp>=T.liqAbs&&r15>=-T.flat&&dO>=-0.001)st="absorbliq";   // ⏸ καίγονται longs, η τιμή δεν πέφτει, το OI κρατάει → κάποιος τα παίρνει
      else if(fin(lqSp)&&lqSp>=T.liqAbs&&r15<=T.flat&&dO>=-0.001)st="absorbliqS";   // ⏸ καίγονται shorts, η τιμή δεν ανεβαίνει → κάποιος πουλάει πάνω τους
      else if(fin(top4)&&fin(ret4)&&top4>=T.xfer&&ret4<=-T.xfer&&Math.abs(r30)<=T.flat*2&&Math.abs(dO)<=T.oi)st="transfer"; // ⏸ μεγάλοι παίρνουν από λιανική, OI σταθερό
      else if(fin(tk)&&tk<=T.tkAbs&&r30>=-T.flat&&dO>=-0.001)st="absorb"; // ⏸ πωλητές επιθετικοί, τιμή δεν πέφτει, OI κρατάει
    }
    out[s]={r30,r15,dO,tk,ext,top,ret,top4,ret4,lqL,lqS,st,c:d.c[j],lo3:Math.min(d.l[j],d.l[j-1],d.l[j-2]),hi3:Math.max(d.h[j],d.h[j-1],d.h[j-2]),oi:o1,ex:EXCL.has(s)}}
  return out}
function market(D,syms,j,S){
  let n=0,up=0,liq=0,dn=0,abs_=0,oiN=0,oiT=0,pw=0,B=0,Sv=0,B3=0,S3=0,B1=0,S1=0,exts=[],nT=0,tU=0,rD=0,tD=0,rU=0;
  for(const s of syms){const x=S[s];if(!x||x.ex||!fin(x.dO))continue;const d=D[s];n++;
    if(fin(x.top4)&&fin(x.ret4)){nT++;if(x.top4>=TH.early.pt)tU++;if(x.ret4<=-TH.early.pt)rD++;if(x.top4<=-TH.early.pt)tD++;if(x.ret4>=TH.early.pt)rU++}
    if(x.r30>0&&x.dO>0)up++;if(x.r30<0&&x.dO<0)liq++;if(x.r30<0&&x.dO>0)dn++;if(x.st==="absorb"||x.st==="load"||x.st==="absorbliq"||x.st==="transfer")abs_++;
    oiN+=d.oi[j];oiT+=d.oi[j-6];pw+=x.r30*d.oi[j];const b=sum(d.tbq,j,6);B+=b;Sv+=sum(d.qv,j,6)-b;const b3=sum(d.tbq,j,3);B3+=b3;S3+=sum(d.qv,j,3)-b3;B1+=d.tbq[j]||0;S1+=(d.qv[j]||0)-(d.tbq[j]||0);if(fin(x.ext))exts.push(x.ext)}
  exts.sort((a,b)=>a-b);
  return {n,br_up:n?up/n:0,br_liq:n?liq/n:0,br_dn:n?dn/n:0,absShare:n?abs_/n:0,moi:oiT?oiN/oiT-1:NaN,mp:oiN?pw/oiN:NaN,tk:Sv?B/Sv:NaN,topUp:nT?tU/nT:0,retDn:nT?rD/nT:0,topDn:nT?tD/nT:0,retUp:nT?rU/nT:0,tk15:S3?B3/S3:NaN,tk5:S1?B1/S1:NaN,oiSum:oiN,ext:exts.length?exts[exts.length>>1]:NaN}}
// ---- σκορ: τι έκανε ιστορικά κάθε σήμα (2021-12 → 2026-10, 22 crypto). Πίνακας σκορ, όχι φίλτρο. ----
// «ήρθε η κίνηση» = +0,5% προς την κατεύθυνση πριν −0,5% αντίθετα, εντός 4ω · [με σήμα, τυχαία ίδια ώρα] ανά συνεδρία (UTC)
const HIST={long:[[47,38],[44,35],[42,37],[44,39],[48,45],[48,41]],short:[[51,39],[51,39],[50,34],[51,39],[55,45],[49,40]]};
const SESSN=["πριν την Ασία","άνοιγμα Ασίας","Ασία","Λονδίνο","Αμερική","βράδυ ΗΠΑ"];
const sessOf=t=>{const h=new Date(t+3e5).getUTCHours();return h>=22?0:h<2?1:h<7?2:h<12?3:h<16?4:5};
function scoreOf(e){
  if(e.type==="watch"){const i=sessOf(e.t);
    if(e.k==="load"){const h=HIST.long[i];return `η κίνηση ήρθε ${h[0]}% (τυχαία ${h[1]}%) · ${SESSN[i]}`}
    if(e.k==="liq"){const h=HIST.short[i];return `η κίνηση ήρθε ${h[0]}% (τυχαία ${h[1]}%) · ${SESSN[i]}`}
    if(e.k==="trap")return "η πτώση συνεχίστηκε μόνο 6–20% (τυχαία 40–46%)";
    if(e.k==="xfer")return "δεν έχει μετρηθεί· παρόμοιο μοτίβο 2025–26: άνοδος 48–51% (τυχαία 42%), πριν το 2025 δεν στεκόταν";
    if(e.k==="dist")return "δεν έχει μετρηθεί· παρόμοιο μοτίβο 2025–26: πτώση 51–56% (τυχαία 42–44%)"}
  if(e.type==="entry")return "παρόμοιος κανόνας scalp: κέρδος στην έξοδο 36–49%, stop 32–47% (τυχαία είσοδος 26–30%)· ρυθμισμένος πάνω στις 9/11";
  if(e.type==="exh")return e.dir>0?"άνοδος με OI↓ γύρισε σε πτώση 59–63% το 2025–26 (με OI↑ 39–40%)":"το αντίστοιχο για πτώση δεν έχει μετρηθεί";
  return ""}
// ---- επεισόδια ----
function run(D,syms,opts){
  const B=D.BTCUSDT;const N=B.t.length;const M=[],SS=[];
  for(let j=0;j<N;j++){const S=j>=6?symStates(D,syms,j):{};SS.push(S);M.push(j>=6?market(D,syms,j,S):null)}
  const OIS=M.map(m=>m?m.oiSum:NaN);
  const ev=[];                                   // όλα τα γεγονότα, χρονολογικά
  const eps={1:null,"-1":null};
  const trigAt=(side,j,m)=>{const c=B.c[j];
    if(side>0){
      if(m.br_up>=TH.load.br&&m.moi>=TH.load.moi&&m.tk>=TH.load.tk&&m.mp>0&&(!fin(m.ext)||m.ext<=TH.load.ext))return {k:"load",t:"🟡 ΦΟΡΤΩΝΕΙ LONG",w:"ισχυρό"};
      if(m.br_dn>=TH.load.br&&m.moi>=TH.load.moi&&m.mp<0)return {k:"trap",t:"⚡ ΠΑΓΙΔΕΥΜΕΝΟΙ SHORTS → πιθανή άνοδος",w:"μέτριο"};
      if(fin(B.c[j-18])&&B.c[j]/B.c[j-18]-1<=-TH.early.move&&m.moi>=-TH.early.oi&&m.tk<=TH.early.tk&&m.topUp>=TH.early.top&&m.retDn>=TH.early.ret)return {k:"xfer",t:"🟡 ΑΠΟΡΡΟΦΗΣΗ LONG · μεγάλοι παίρνουν από λιανική",w:"πρώιμο"};
    }else{
      if(m.br_liq>=TH.liq.br&&m.moi<=TH.liq.moi&&m.tk<=TH.liq.tk&&m.mp<0&&(!fin(m.ext)||m.ext>=-TH.liq.ext))return {k:"liq",t:"🟡 ΦΟΡΤΩΝΕΙ SHORT · ρευστοποίηση longs",w:"ισχυρό"};
      if(fin(B.c[j-18])&&B.c[j]/B.c[j-18]-1>=TH.early.move&&m.moi>=-TH.early.oi&&m.tk>=1/TH.early.tk&&m.topDn>=TH.early.top&&m.retUp>=TH.early.ret)return {k:"dist",t:"🟡 ΔΙΑΝΟΜΗ SHORT · μεγάλοι δίνουν στη λιανική",w:"πρώιμο"};
    }
    return null};
  const symsFor=(side,j,k)=>Object.keys(SS[j]).filter(s=>{const x=SS[j][s];if(x.ex)return false;if(k==="xfer")return x.top4>=TH.early.pt&&x.ret4<=-TH.early.pt;if(k==="dist")return x.top4<=-TH.early.pt&&x.ret4>=TH.early.pt;return side>0?x.st==="load":x.st==="liq"});
  const baseAt=(side,j)=>side>0?Math.min(...B.l.slice(j-6,j+1)):Math.max(...B.h.slice(j-6,j+1));
  for(let j=12;j<N;j++){const m=M[j];if(!m||m.n<15)continue;const c=B.c[j];
    const lo12=Math.min(...B.l.slice(j-TH.swing-2,j-2)),hi12=Math.max(...B.h.slice(j-TH.swing-2,j-2)); // swing πριν το σκούπισμα (εξαιρεί τις 3 τελευταίες)
    const trig={1:trigAt(1,j,m),"-1":trigAt(-1,j,m)};
    for(const side of [1,-1]){const tr=trig[side],opp=trig[-side];let ep=eps[side];
      // αντίθετο ισχυρό φόρτωμα: κλείνει ό,τι τρέχει στην άλλη πλευρά
      if(ep&&opp&&opp.w==="ισχυρό"){
        if(ep.phase==="move"){const gain=side*(c/ep.epx-1);ev.push({j,t:B.t[j],dir:side,type:"end",label:side>0?"❌ ΤΕΛΟΣ · ρευστοποίηση στην αγορά — κλείσε το long":"❌ ΤΕΛΟΣ · φορτώνει long η αγορά — κλείσε το short",px:c,gain,peak:side*(ep.ext/ep.epx-1),m})}
        else ev.push({j,t:B.t[j],dir:side,type:"fade",label:"❌ ΑΚΥΡΩΘΗΚΕ · γύρισε η αγορά στην άλλη πλευρά",px:c});
        eps[side]=null;continue}
      if(!ep){ if(tr){const syms=symsFor(side,j,tr.k);eps[side]={dir:side,k:tr.k,start:j,last:j,base:baseAt(side,j),oi0:OIS[j],syms,re:0};
          ev.push({j,t:B.t[j],dir:side,type:"watch",k:tr.k,label:tr.t,w:tr.w,px:c,n:syms.length,syms,m})}
        continue}
      if(ep.phase!=="move"){
        // πρώιμη παρακολούθηση: το κανονικό 🟡 την επιβεβαιώνει αμέσως (νέα βάση, νέος χρόνος)· ως τότε δεν δίνει 🎯
        const early=ep.k==="xfer"||ep.k==="dist";
        if(early&&tr&&tr.w!=="πρώιμο"){const syms=symsFor(side,j,tr.k);ep.k=tr.k;ep.start=j;ep.last=j;ep.base=baseAt(side,j);ep.syms=syms;ep.confirmed=true;
          ev.push({j,t:B.t[j],dir:side,type:"watch",k:tr.k,label:tr.t+" · επιβεβαιώνει το πρώιμο",w:tr.w,px:c,n:syms.length,syms,m});continue}
        // ξανά φόρτωμα ≥30′ μετά: ανανεώνει την παρακολούθηση (νέα βάση, νέος χρόνος)
        if(tr&&(tr.w!=="πρώιμο"||ep.k===tr.k)&&j-ep.last>=6){const syms=symsFor(side,j,tr.k);ep.k=tr.k;ep.start=j;ep.last=j;ep.base=baseAt(side,j);ep.syms=syms;ep.re++;
          ev.push({j,t:B.t[j],dir:side,type:"watch",k:tr.k,label:tr.t.replace("ΦΟΡΤΩΝΕΙ","ΦΟΡΤΩΝΕΙ ΞΑΝΑ"),w:tr.w,px:c,n:syms.length,syms,m,re:ep.re});continue}
        if(tr)ep.last=j;
        const failed=side>0?c<ep.base*(1-TH.cancel):c>ep.base*(1+TH.cancel);
        if(failed||j-ep.start>TH.watchMax){ev.push({j,t:B.t[j],dir:side,type:"fade",label:failed?"❌ ΑΚΥΡΩΘΗΚΕ · έσπασε τη βάση":"⌛ ΕΣΒΗΣΕ · 6ω χωρίς κίνηση",px:c});eps[side]=null;continue}
        if(early)continue; // περιμένει επιβεβαίωση
        const sweep=side>0?Math.min(B.l[j-2],B.l[j-1],B.l[j])<lo12*(1-TH.sweepMin):Math.max(B.h[j-2],B.h[j-1],B.h[j])>hi12*(1+TH.sweepMin);
        const back=side>0?(c>lo12&&c>B.c[j-1]):(c<hi12&&c<B.c[j-1]);
        const oiOK=side>0?OIS[j]>OIS[j-2]:OIS[j]<=OIS[j-2]*1.001;
        const tkOK=side>0?m.tk5>1:m.tk5<1;
        if(sweep&&back&&oiOK&&tkOK){
          const list=Object.entries(SS[j]).filter(([s,x])=>!x.ex&&fin(x.dO)&&(side>0?(x.dO>0&&x.r15>=-0.001):(x.dO<0&&x.r15<=0.001))).sort((a,b)=>side*(b[1].dO-a[1].dO)).map(([s,x])=>({s,ref:x.c,edge:side>0?x.lo3:x.hi3,dO:x.dO}));
          ep.phase="move";ep.entry=j;ep.epx=c;ep.edge=side>0?Math.min(B.l[j-2],B.l[j-1],B.l[j]):Math.max(B.h[j-2],B.h[j-1],B.h[j]);ep.ext=c;ep.oiPk=OIS[j];
          ev.push({j,t:B.t[j],dir:side,type:"entry",label:side>0?"🎯 ΕΙΣΟΔΟΣ LONG · σκούπισμα & επιστροφή με νέο OI":"🎯 ΕΙΣΟΔΟΣ SHORT · σκούπισμα & επιστροφή",px:c,edge:ep.edge,list,m})}
        continue}
      // --- σε κίνηση ---
      ep.ext=side>0?Math.max(ep.ext,B.h[j]):Math.min(ep.ext,B.l[j]);ep.oiPk=Math.max(ep.oiPk,OIS[j]);
      const gain=side*(c/ep.epx-1);
      const stop=side>0?c<ep.edge:c>ep.edge;
      const oiMax6=Math.max(...OIS.slice(j-6,j+1));
      const nearExt=side>0?Math.max(B.h[j],B.h[j-1],B.h[j-2])>=ep.ext*(1-TH.exh.near):Math.min(B.l[j],B.l[j-1],B.l[j-2])<=ep.ext*(1+TH.exh.near);
      const exh=!ep.exh&&nearExt&&OIS[j]<=oiMax6*(1-TH.exh.oiDrop)&&(side>0?m.tk15<=TH.exh.tk:m.tk15>=1/TH.exh.tk)&&gain>=TH.exh.minGain;
      if(exh){ep.exh=j;ev.push({j,t:B.t[j],dir:side,type:"exh",label:side>0?"🔴 ΕΞΑΣΘΕΝΗΣΗ · νέα υψηλά, το OI φεύγει":"🔴 ΕΞΑΣΘΕΝΗΣΗ · νέα χαμηλά, το OI φεύγει",px:c,gain,m});continue}
      const lo3p=Math.min(B.l[j-3],B.l[j-2],B.l[j-1]),hi3p=Math.max(B.h[j-3],B.h[j-2],B.h[j-1]);
      const rev=side>0?(c<lo3p&&ep.ext/c-1>=TH.end.drop):(c>hi3p&&c/ep.ext-1>=TH.end.drop);
      const interestGone=OIS[j]<OIS[j-3]||(side>0?m.tk15<TH.end.tk:m.tk15>1/TH.end.tk);
      if(stop||(rev&&interestGone)||j-ep.entry>TH.moveMax){
        const baseOK=side>0?c>=ep.base*(1-TH.cancel):c<=ep.base*(1+TH.cancel);
        const back=(stop||gain<0)&&baseOK&&j-ep.start<=TH.watchMax&&!ep.reentered; // χαμένη είσοδος με τη βάση άθικτη: μία ακόμα ευκαιρία
        ev.push({j,t:B.t[j],dir:side,type:"end",label:(stop?"❌ STOP · έσπασε την άκρη του fake":(rev?"❌ ΤΕΛΟΣ · χάθηκε το ενδιαφέρον":"⌛ ΤΕΛΟΣ · 6ω"))+(back?" · η βάση κρατάει, ξανά σε παρακολούθηση":""),px:c,gain,peak:side*(ep.ext/ep.epx-1),m});
        if(back){ep.phase="watch";ep.reentered=true;delete ep.entry;delete ep.exh}else eps[side]=null}
    }
  }
  for(const side of [1,-1]){const ep=eps[side];if(ep)ev.push({j:N-1,t:B.t[N-1],dir:side,type:"open",phase:ep.phase||"watch",ep})}
  for(const e of ev)e.score=scoreOf(e);
  ev.sort((a,b)=>a.j-b.j||a.dir-b.dir);
  return {ev,M,SS,N}}
root.TGLOAD={run,symStates,market,TH,EXCL};
})(typeof module!=="undefined"?module.exports:window);
