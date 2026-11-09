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
function msg(e,D,now){const delay=Math.round((now-(e.t+3e5))/6e4);const hdr=`**${e.label}** · ${tA(e.t+3e5)}${delay>7?` · ⚠️ εκπρόθεσμο +${delay}′`:` · +${delay}′`}\nBTC **${px(e.px)}**`;
  if(e.type==="watch"&&(e.k==="xfer"||e.k==="dist"))return `${hdr} · **ΠΡΩΙΜΟ** · μεγάλοι ${e.k==="xfer"?"▲":"▼"} σε ${Math.round((e.k==="xfer"?e.m.topUp:e.m.topDn)*100)}% των συμβόλων, λιανική ${e.k==="xfer"?"▼":"▲"} σε ${Math.round((e.k==="xfer"?e.m.retDn:e.m.retUp)*100)}% · OI αγοράς ${pc(e.m.moi)} σε 30′ (σταμάτησε να φεύγει) · ${e.k==="xfer"?"πωλητές":"αγοραστές"} ${(e.k==="xfer"?1/e.m.tk:e.m.tk).toFixed(2)}\n${e.syms.map(nm).join(", ")}\n_Πρώιμη ένδειξη, δεν έχει μετρηθεί στο ιστορικό. Παρακολούθηση: περιμένουμε σκούπισμα της άκρης και επιστροφή με νέο OI._`;
  if(e.type==="watch")return `${hdr} · ${e.n} σύμβολα φορτώνουν · OI αγοράς ${pc(e.m.moi)} σε 30′ · ${e.dir>0?"αγοραστές":"πωλητές"} ${(e.dir>0?e.m.tk:1/e.m.tk).toFixed(2)}${e.w!=="ισχυρό"?` · ένδειξη ${e.w}`:""}\n${e.syms.map(nm).join(", ")}\n_Παρακολούθηση. Περιμένουμε σκούπισμα της άκρης και επιστροφή με νέο OI._`;
  if(e.type==="entry"){const L=e.list;const lines=L.slice(0,22).map((z,i)=>`${i+1}. **${nm(z.s)}** ${px(z.ref)} · άκρη ${px(z.edge)} · OI ${pc(z.dO)}`).join("\n");return `${hdr} · άκρη BTC **${px(e.edge)}** (αναφορά stop)\n${L.length} σύμβολα, με σειρά φορτώματος:\n${lines}\n_Scalp: έξοδος στο 🔴 ή στο ❌, όχι 24ωρο. Δεν είναι συμβουλή._`}
  if(e.type==="exh")return `${hdr} · από την είσοδο ${pc(e.gain)}\n_Νέα άκρα χωρίς νέες θέσεις (OI φεύγει, takers σβήνουν). Ιστορικά 2025–26 άνοδος με OI↓ γύρισε 59–63%. Όχι νέα είσοδος· σκέψου κλείσιμο._`;
  if(e.type==="end")return `${hdr} · αποτέλεσμα ${pc(e.gain)} · κορυφή ${pc(e.peak)}`;
  if(e.type==="fade")return hdr;
  return null}
async function post(content){if(DRY){console.log("DRY>",content.slice(0,300).replace(/\n/g," | "));return}const r=await fetch(HOOK,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content:content.slice(0,1900)})});if(!r.ok)throw new Error("discord "+r.status)}
(async()=>{
  if(!HOOK&&!DRY){console.log("no webhook");process.exit(0)}
  let st={sent:{}};try{st=JSON.parse(fs.readFileSync(STATE,"utf8"))}catch(e){}
  const D=await fetchAll();const out=TGLOAD.run(D,SYMS);const now=Date.now();
  const first=!Object.keys(st.sent).length;
  const ev=out.ev.filter(e=>e.type!=="open"&&!(e.type==="watch"&&e.w==="ασθενές")&&now-(e.t+3e5)<=(+process.env.WINDOW_MIN||(first?30:90))*6e4);
  let n=0;for(const e of ev){const key=e.type+"|"+e.dir+"|"+e.t;if(st.sent[key])continue;const m=msg(e,D,now);if(!m)continue;await post(m);st.sent[key]=now;n++}
  if(process.env.TEST_MSG==="1")await post("✅ Δοκιμή: οι ειδοποιήσεις «Φόρτωμα αγοράς» συνδέθηκαν. Τελευταίο κερί "+tA(D.BTCUSDT.t[out.N-1]+3e5)+" · BTC "+px(D.BTCUSDT.c[out.N-1]));
  for(const k in st.sent)if(now-st.sent[k]>3*864e5)delete st.sent[k];
  fs.mkdirSync(path.dirname(STATE),{recursive:true});fs.writeFileSync(STATE,JSON.stringify(st));
  console.log("bars",out.N,"events",out.ev.length,"sent",n);
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
