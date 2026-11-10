// Φόρτωμα αγοράς → Discord. Τρέχει κάθε 5′ (GitHub Actions). Ίδια μηχανή με τη σελίδα (tgload.js).
// Χρειάζεται μόνο DISCORD_WEBHOOK. Δεν τυπώνει μυστικά.
const fs=require('fs');const path=require('path');
const {TGLOAD}=require(path.join(__dirname,'..','tgload.js'));
const SYMS=["AAVEUSDT","ADAUSDT","AVAXUSDT","BCHUSDT","BNBUSDT","BTCUSDT","DOGEUSDT","DOTUSDT","ETHUSDT","HYPEUSDT","LINKUSDT","LTCUSDT","NEARUSDT","PUMPUSDT","RUNEUSDT","SOLUSDT","SUIUSDT","TONUSDT","TRXUSDT","XAUUSDT","XMRUSDT","XRPUSDT","ZECUSDT"];
const API=process.env.BINANCE_BASE||"https://www.binance.com";const HOOK=process.env.DISCORD_WEBHOOK;const STATE=process.env.STATE_FILE||".notify/load.json";const DRY=!!process.env.DRY_RUN;
const NB=100;
async function j(u){for(let a=0;a<3;a++){try{const r=await fetch(u,{headers:{"user-agent":"tg-load/2"}});if(r.ok)return await r.json();if(r.status===429||r.status===418)await new Promise(r=>setTimeout(r,4000))}catch(e){}await new Promise(r=>setTimeout(r,800))}throw new Error("fetch failed")}
async function pool(items,n,fn){const out=[];let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const k=i++;try{out[k]=await fn(items[k])}catch(e){out[k]=null}}}));return out}
async function fetchAll(){const now=Date.now();const D={};
  await pool(SYMS,4,async s=>{const q=`symbol=${s}&period=5m&limit=${NB}`;
    const [k5,k4,oi,tp,gl]=await Promise.all([j(`${API}/fapi/v1/klines?symbol=${s}&interval=5m&limit=${NB}`),j(`${API}/fapi/v1/klines?symbol=${s}&interval=4h&limit=30`),j(`${API}/futures/data/openInterestHist?${q}`),j(`${API}/futures/data/topLongShortPositionRatio?${q}`).catch(()=>[]),j(`${API}/futures/data/globalLongShortAccountRatio?${q}`).catch(()=>[])]);
    const c4=k4.filter(x=>+x[6]<now);let tr=[];for(let i=1;i<c4.length;i++){const h=+c4[i][2],l=+c4[i][3],p=+c4[i-1][4];tr.push(Math.max(h-l,Math.abs(h-p),Math.abs(l-p)))}
    D[s]={k:new Map(k5.filter(x=>+x[6]<now).map(x=>[+x[0],x])),oi:new Map(oi.map(x=>[+x.timestamp,+x.sumOpenInterestValue])),tp:new Map(tp.map(x=>[+x.timestamp,+x.longAccount])),gl:new Map(gl.map(x=>[+x.timestamp,+x.longAccount])),atr4:tr.slice(-14).reduce((a,b)=>a+b,0)/Math.max(1,Math.min(14,tr.length))}});
  if(!D.BTCUSDT)throw new Error("no BTC");const T=[...D.BTCUSDT.k.keys()].sort((a,b)=>a-b);const g=(m,t)=>{const v=m.get(t+3e5)??m.get(t);return v===undefined?NaN:v};const out={};
  for(const s of SYMS){const d=D[s];if(!d)continue;const K=t=>d.k.get(t);out[s]={t:T,o:T.map(t=>K(t)?+K(t)[1]:NaN),h:T.map(t=>K(t)?+K(t)[2]:NaN),l:T.map(t=>K(t)?+K(t)[3]:NaN),c:T.map(t=>K(t)?+K(t)[4]:NaN),qv:T.map(t=>K(t)?+K(t)[7]:NaN),tbq:T.map(t=>K(t)?+K(t)[10]:NaN),oi:T.map(t=>g(d.oi,t)),top:T.map(t=>g(d.tp,t)),ret:T.map(t=>g(d.gl,t)),atr4:d.atr4}}
  return out}
const tA=t=>new Date(t).toLocaleTimeString("el-GR",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Europe/Athens"});
const pc=x=>(x>0?"+":"")+(x*100).toFixed(2)+"%";const px=v=>v>=1000?Math.round(v).toLocaleString("el-GR"):v>=1?v.toFixed(v>=100?2:3):v.toPrecision(4);
const nm=s=>s.replace("USDT","");
function msg(e,D,now){const m=msg0(e,D,now);return m&&e.score?m+`\n📊 _${e.score}_`:m}
function msg0(e,D,now){const delay=Math.round((now-(e.t+3e5))/6e4);const hdr=`**${e.label}** · ${tA(e.t+3e5)}${delay>7?` · ⚠️ εκπρόθεσμο +${delay}′`:` · +${delay}′`}\nBTC **${px(e.px)}**`;
  if(e.type==="watch"&&(e.k==="xfer"||e.k==="dist"))return `${hdr} · **ΠΡΩΙΜΟ** · μεγάλοι ${e.k==="xfer"?"▲":"▼"} σε ${Math.round((e.k==="xfer"?e.m.topUp:e.m.topDn)*100)}% των συμβόλων, λιανική ${e.k==="xfer"?"▼":"▲"} σε ${Math.round((e.k==="xfer"?e.m.retDn:e.m.retUp)*100)}% · OI αγοράς ${pc(e.m.moi)} σε 30′ (σταμάτησε να φεύγει) · ${e.k==="xfer"?"πωλητές":"αγοραστές"} ${(e.k==="xfer"?1/e.m.tk:e.m.tk).toFixed(2)}\n${e.syms.map(nm).join(", ")}\n_Πρώιμη ένδειξη, δεν έχει μετρηθεί στο ιστορικό. Παρακολούθηση: περιμένουμε σκούπισμα της άκρης και επιστροφή με νέο OI._`;
  if(e.type==="watch")return `${hdr} · ${e.n} σύμβολα φορτώνουν · OI αγοράς ${pc(e.m.moi)} σε 30′ · ${e.dir>0?"αγοραστές":"πωλητές"} ${(e.dir>0?e.m.tk:1/e.m.tk).toFixed(2)}${e.w!=="ισχυρό"?` · ένδειξη ${e.w}`:""}\n${e.syms.map(nm).join(", ")}\n_Παρακολούθηση. Περιμένουμε σκούπισμα της άκρης και επιστροφή με νέο OI._`;
  if(e.type==="entry"){const L=e.list;const lines=L.slice(0,22).map((z,i)=>`${i+1}. **${nm(z.s)}** ${px(z.ref)} · άκρη ${px(z.edge)} · OI ${pc(z.dO)}`).join("\n");return `${hdr} · άκρη BTC **${px(e.edge)}** (αναφορά stop)\n${L.length} σύμβολα, με σειρά φορτώματος:\n${lines}\n_Scalp: έξοδος στο 🔴 ή στο ❌, όχι 24ωρο. Δεν είναι συμβουλή._`}
  if(e.type==="exh")return `${hdr} · από την είσοδο ${pc(e.gain)}\n_Νέα άκρα χωρίς νέες θέσεις (OI φεύγει, takers σβήνουν). Όχι νέα είσοδος· σκέψου κλείσιμο._`;
  if(e.type==="end")return `${hdr} · αποτέλεσμα ${pc(e.gain)} · κορυφή ${pc(e.peak)}`;
  if(e.type==="fade")return hdr;
  return null}
// ---- ⚡ σκούπισμα & επιστροφή: ειδοποίηση στιγμής («κοίτα τώρα», όχι σήμα) ----
const SW={mn:0.0005,K:2,Ws:[[90,"7ω"],[48,"4ω"],[12,"1ω"]],fresh:10,cool:3,mkt:7};
function newsBars(d,j){const out=[];for(let b=Math.max(51,j-48);b<j;b++){const r=(d.h[b]-d.l[b])/d.c[b];if(!(r>=0.006))continue;const pr=[];for(let k=b-50;k<b;k++){const v=(d.h[k]-d.l[k])/d.c[k];if(v===v)pr.push(v)}if(pr.length<30)continue;pr.sort((a,b)=>a-b);if(r>=5*pr[pr.length>>1])out.push(b)}return out}
function swTry(d,j,dir,refAt,minI){for(let i=Math.max(minI,j-SW.K);i<=j;i++){const ref=refAt(i);if(!(ref>0)||!isFinite(ref))continue;
    if(!(dir>0?d.l[i]<ref*(1-SW.mn):d.h[i]>ref*(1+SW.mn)))continue;if(!(dir>0?d.c[j]>ref:d.c[j]<ref))continue;
    let early=false;for(let k=i;k<j;k++)if(dir>0?d.c[k]>ref:d.c[k]<ref){early=true;break}if(early)continue;
    let edge=dir>0?Infinity:-Infinity;for(let k=i;k<=j;k++)edge=dir>0?Math.min(edge,d.l[k]):Math.max(edge,d.h[k]);return {ref,edge,i}}return null}
function swAt(d,j,news){let best=null;for(const dir of [1,-1]){let hit=null;
    if(news)for(const b of newsBars(d,j)){const r=swTry(d,j,dir,()=>dir>0?d.l[b]:d.h[b],b+1);if(r){hit=Object.assign(r,{dir,W:999,lab:"κεριού νέων "+tA(d.t[b]+3e5)});break}}
    if(!hit)for(const [W,lab] of SW.Ws){const r=swTry(d,j,dir,i=>{if(i-W<0)return NaN;let ref=dir>0?Infinity:-Infinity;for(let k=i-W;k<i;k++){const v=dir>0?d.l[k]:d.h[k];if(v===v)ref=dir>0?Math.min(ref,v):Math.max(ref,v)}return ref},W);if(r){hit=Object.assign(r,{dir,W,lab});break}}
    if(hit&&(!best||hit.W>best.W))best=hit}return best}
function sweepEvents(D,j){const per={};for(const s of SYMS){const d=D[s];if(!d||!(d.c[j]===d.c[j]))continue;const e=swAt(d,j,s==="BTCUSDT");if(e)per[s]=e}
  const cry=Object.keys(per).filter(s=>!TGLOAD.EXCL.has(s));const out=[];const nC=SYMS.filter(s=>D[s]&&!TGLOAD.EXCL.has(s)&&D[s].c[j]===D[s].c[j]).length;
  for(const dir of [1,-1]){const list=cry.filter(s=>per[s].dir===dir);const b=per.BTCUSDT&&per.BTCUSDT.dir===dir?per.BTCUSDT:null;if(!b&&list.length<SW.mkt)continue;out.push({type:"sweep",dir,t:D.BTCUSDT.t[j],j,b,list,nC,W:b?b.W:0})}return out}
function sweepMsg(e,D,out,now){const B=D.BTCUSDT,j=e.j;const delay=Math.round((now-(e.t+3e5))/6e4);const sg=x=>(x>0?"+":"")+x.toFixed(1);
  const oi15=B.oi[j]/B.oi[j-3]-1;let a=0,b0=0;for(const s of SYMS){if(TGLOAD.EXCL.has(s)||!D[s])continue;const x=D[s].oi[j],y=D[s].oi[j-3];if(x>0&&y>0){a+=x;b0+=y}}const moi15=b0>0?a/b0-1:NaN;
  const tk=k=>{let bq=0,q=0;for(let i=j-k+1;i<=j;i++){bq+=B.tbq[i];q+=B.qv[i]}return bq/(q-bq)};
  const dTop=(B.top[j]-B.top[j-12])*100,dRet=(B.ret[j]-B.ret[j-12])*100;
  const op=out.ev.filter(x=>x.type==="open").pop();const eng=op&&op.ep?(op.ep.phase==="move"?"🎯 σε κίνηση ":"🟡 παρακολούθηση ")+(op.ep.dir>0?"LONG":"SHORT"):"ήσυχα";
  const side=e.dir>0?"ΚΑΤΩ":"ΠΑΝΩ";const l1=`**⚡ ΚΟΙΤΑ ΤΩΡΑ · σκούπισμα ${side} & επιστροφή** · ${tA(e.t+3e5)} · +${delay}′`;
  const l2=e.b?`BTC **${px(B.c[j])}** · πέρασε το ${e.dir>0?"χαμηλό":"υψηλό"} ${e.b.lab} (${px(e.b.ref)}) έως **${px(e.b.edge)}** και γύρισε`:`BTC **${px(B.c[j])}** · το BTC δεν σκούπισε, σκουπίζει η αγορά`;
  const l3=`OI BTC 15′ ${pc(oi15)} · OI αγοράς 15′ ${pc(moi15)} · αγοραστές/πωλητές κεριού ${tk(1).toFixed(2)} · 15′ ${tk(3).toFixed(2)}`;
  const l4=`Μεγάλοι 1ω ${sg(dTop)} · Λιανική 1ω ${sg(dRet)} (μονάδες % long)`;
  const l5=`Σκουπίζουν μαζί ${e.list.length}/${e.nC}${e.list.length?": "+e.list.map(nm).join(", "):""}`;
  return [l1,l2,l3,l4,l5,`Μηχανή: ${eng}`,`_Ένδειξη στιγμής, όχι σήμα εισόδου. Ιστορικά 1 στις 4 τρέχει ≥0,5% πριν σπάσει η ουρά._`].join("\n")}
async function post(content){if(DRY){console.log("DRY>",content.slice(0,300).replace(/\n/g," | "));return}const r=await fetch(HOOK,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content:content.slice(0,1900)})});if(!r.ok)throw new Error("discord "+r.status)}
if(process.env.LIB==="1"){module.exports={fetchAll,sweepEvents,sweepMsg,SYMS,TGLOAD,tA}}else (async()=>{
  if(!HOOK&&!DRY){console.log("no webhook");process.exit(0)}
  let st={sent:{}};try{st=JSON.parse(fs.readFileSync(STATE,"utf8"))}catch(e){}
  const D=await fetchAll();const out=TGLOAD.run(D,SYMS);const now=Date.now();
  let pNow=NaN;try{pNow=+(await j(`${API}/fapi/v1/ticker/price?symbol=BTCUSDT`)).price}catch(e){pNow=D.BTCUSDT.c[out.N-1]}
  st.sentP=st.sentP||{};const sweeps=[];
  const first=!Object.keys(st.sent).length;
  const ev=out.ev.filter(e=>e.type!=="open"&&!(e.type==="watch"&&e.w==="ασθενές")&&now-(e.t+3e5)<=(+process.env.WINDOW_MIN||(first?30:90))*6e4);
  let n=0;for(const e of ev){const key=e.type+"|"+e.dir+"|"+e.t;if(st.sent[key])continue;const m=msg(e,D,now);if(!m)continue;await post(m);st.sent[key]=Date.now();st.sentP[key]=pNow;n++}
  // ⚡ σκούπισμα: μόνο φρέσκο (≤10′), με ανάπαυλα 3 κεριών ανά πλευρά εκτός αν σκουπίστηκε μεγαλύτερο άκρο
  st.sw=st.sw||{};if(process.env.NO_SWEEP!=="1")for(const jj of [out.N-2,out.N-1]){if(jj<SW.Ws[2][0]+SW.K+1)continue;for(const e of sweepEvents(D,jj)){const key="sweep|"+e.dir+"|"+e.t;if(st.sent[key])continue;if(now-(e.t+3e5)>(+process.env.SWEEP_FRESH||SW.fresh)*6e4)continue;
      const pv=st.sw[e.dir];if(pv&&e.t>pv.t&&e.t-pv.t<=SW.cool*3e5&&e.W<=pv.W)continue;await post(sweepMsg(e,D,out,now));const ts=Date.now();st.sent[key]=ts;st.sw[e.dir]={t:e.t,W:e.W};n++;
      sweeps.push({key,t:e.t,dir:e.dir,sent:ts,p:pNow,px:D.BTCUSDT.c[e.j],edge:e.b?e.b.edge:NaN,list:e.list,lab:e.b?`σκούπισμα ${e.dir>0?"κάτω":"πάνω"} & επιστροφή · ${e.b.lab}`:`σκούπισμα αγοράς ${e.dir>0?"κάτω":"πάνω"} · ${e.list.length} σύμβολα`})}}
  if(process.env.TEST_MSG==="1")await post("✅ Δοκιμή: οι ειδοποιήσεις «Φόρτωμα αγοράς» συνδέθηκαν. Τελευταίο κερί "+tA(D.BTCUSDT.t[out.N-1]+3e5)+" · BTC "+px(D.BTCUSDT.c[out.N-1]));
  let lg="";if(process.env.NO_LOG!=="1"){try{const r=await require(path.join(__dirname,"tglog.js"))({D,out,st,now,pNow,sweeps,API,j,EXCL:TGLOAD.EXCL});lg=JSON.stringify(r)}catch(e){lg="log error "+e.message}}
  for(const k in st.sent)if(now-st.sent[k]>3*864e5)delete st.sent[k];
  fs.mkdirSync(path.dirname(STATE),{recursive:true});fs.writeFileSync(STATE,JSON.stringify(st));
  console.log("bars",out.N,"events",out.ev.length,"sent",n,"log",lg);
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
