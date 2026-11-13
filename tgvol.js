// TG Πρόβλεψη · «Volume αγοράς»: σχετικός όγκος, μεγάλες εκτελέσεις, Coinbase spot BTC.
// Ανεξάρτητο κουτί: μόνο ανάγνωση. Δεν αλλάζει το μοντέλο, το φόρτωμα, ούτε τα άλλα κουτιά.
(function(){
"use strict";
const API="https://fapi.binance.com";
const SY=["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","BNBUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT","LINKUSDT","SUIUSDT","LTCUSDT","HYPEUSDT","AAVEUSDT","BCHUSDT","DOTUSDT","NEARUSDT","PUMPUSDT","RUNEUSDT","TONUSDT","TRXUSDT","XMRUSDT","ZECUSDT","XAUUSDT","QQQUSDT","SPYUSDT"];
const TRAD=new Set(["XAUUSDT","QQQUSDT","SPYUSDT"]);
const NM={XAUUSDT:"Χρυσός",QQQUSDT:"Nasdaq",SPYUSDT:"S&P 500"};const nm=s=>NM[s]||s.replace("USDT","");
const $=id=>document.getElementById(id),fin=Number.isFinite;
const usd=v=>!fin(v)?"—":Math.abs(v)>=1e9?(v/1e9).toFixed(2)+" δισ.":Math.abs(v)>=1e6?(v/1e6).toFixed(Math.abs(v)>=1e7?0:1)+" εκ.":Math.abs(v)>=1e3?Math.round(v/1e3)+" χιλ.":Math.round(v)+"";
const sus=v=>!fin(v)?"—":(v>0?"+":v<0?"−":"")+usd(Math.abs(v));
const cl=v=>v>0?"up":v<0?"dn":"";
const xx=v=>!fin(v)?"—":v.toFixed(v>=10?0:1).replace(".",",")+"×";
const tA=t=>new Date(t).toLocaleTimeString("el-GR",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Europe/Athens"});
const J=async u=>{const r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()};
const med=a=>{const b=a.filter(fin).sort((x,y)=>x-y);if(!b.length)return NaN;const m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
const nice=v=>{const p=Math.pow(10,Math.floor(Math.log10(v)));const f=v/p;return (f<1.5?1:f<3.5?2.5:f<7.5?5:10)*p};

const S={base:{},cur:{},v15:{},thr:{},big:{},grp:{},from:Date.now(),ws:null,wsState:"—",cb:[],cbGrp:null,cbFrom:Date.now(),cbWs:null,cbState:"—",T:{},err:null};
SY.forEach(s=>{S.big[s]=[]});

// ---------- όγκος ----------
async function loadBase(){ // διάμεσος ωριαίου όγκου (σε $) της ίδιας ώρας UTC, τελευταίες 14 μέρες
  await Promise.all(SY.map(async s=>{try{const k=await J(`${API}/fapi/v1/klines?symbol=${s}&interval=1h&limit=340`);const byH={};
    for(const b of k.slice(0,-1)){const h=new Date(+b[0]).getUTCHours();(byH[h]=byH[h]||[]).push(+b[7])}S.base[s]=byH}catch(e){}}))}
async function loadCur(){
  await Promise.all(SY.map(async s=>{try{const k=await J(`${API}/fapi/v1/klines?symbol=${s}&interval=5m&limit=12`);S.cur[s]=k.reduce((a,b)=>a+(+b[7]),0);S.v15[s]=k.slice(-3).reduce((a,b)=>a+(+b[7]),0)}catch(e){}}))}
async function loadThr(){const t=await J(`${API}/fapi/v1/ticker/24hr`);for(const x of t)if(SY.includes(x.symbol))S.thr[x.symbol]=Math.min(1e5,Math.max(1e4,nice(+x.quoteVolume/2e5)))}
function rv(s){const byH=S.base[s];if(!byH||!fin(S.cur[s]))return NaN;const b=med(byH[new Date().getUTCHours()]||[]);return b>0?S.cur[s]/b:NaN}
function baseNow(s){const byH=S.base[s];return byH?med(byH[new Date().getUTCHours()]||[]):NaN}

// ---------- μεγάλες εκτελέσεις Binance (όλα τα σύμβολα, μία σύνδεση) ----------
function push(s,t,taker,v){const g=S.grp[s];if(g&&g.side===taker&&t-g.t1<=150){g.v+=v;g.t1=t;return}flush(s);S.grp[s]={t0:t,t1:t,side:taker,v}}
function flush(s){const g=S.grp[s];if(!g)return;S.grp[s]=null;if(g.v>=(S.thr[s]||1e5))S.big[s].push({t:g.t0,side:g.side,v:g.v})}
function wsStart(){try{if(S.ws){S.ws.onclose=null;S.ws.close()}}catch(e){}S.wsState="σύνδεση…";
  try{const w=new WebSocket("wss://fstream.binance.com/market/stream?streams="+SY.map(s=>s.toLowerCase()+"@aggTrade").join("/"));S.ws=w;
    w.onopen=()=>{S.wsState="σύνδεση ανοιχτή, περιμένει δεδομένα"};
    w.onmessage=e=>{S.wsState="ζωντανό";try{const m=JSON.parse(e.data).data;if(!m||!S.big[m.s])return;push(m.s,+m.T,m.m?"S":"B",(+m.p)*(+m.q))}catch(_){}};
    w.onerror=()=>{S.wsState="σφάλμα σύνδεσης"};
    w.onclose=()=>{S.wsState="αποσυνδέθηκε · ξανασυνδέεται";setTimeout(wsStart,4000)}}catch(e){S.wsState="δεν υποστηρίζεται"}}

// ---------- μεγάλες εκτελέσεις Coinbase spot BTC-USD ----------
const CB_THR=5e4;
function cbPush(t,taker,v){const g=S.cbGrp;if(g&&g.side===taker&&t-g.t1<=150){g.v+=v;g.t1=t;return}cbFlush();S.cbGrp={t0:t,t1:t,side:taker,v}}
function cbFlush(){const g=S.cbGrp;if(!g)return;S.cbGrp=null;if(g.v>=CB_THR)S.cb.push({t:g.t0,side:g.side,v:g.v})}
function cbStart(){try{if(S.cbWs){S.cbWs.onclose=null;S.cbWs.close()}}catch(e){}S.cbState="σύνδεση…";
  try{const w=new WebSocket("wss://ws-feed.exchange.coinbase.com");S.cbWs=w;
    w.onopen=()=>{S.cbState="ζωντανό";w.send(JSON.stringify({type:"subscribe",product_ids:["BTC-USD"],channels:["matches"]}))};
    // Coinbase: το side είναι η πλευρά του maker· side "sell" = αγόρασε ο taker
    w.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type!=="match"&&m.type!=="last_match")return;if(m.type==="last_match")return;cbPush(Date.parse(m.time),m.side==="sell"?"B":"S",(+m.price)*(+m.size))}catch(_){}};
    w.onerror=()=>{S.cbState="σφάλμα σύνδεσης"};
    w.onclose=()=>{S.cbState="αποσυνδέθηκε · ξανασυνδέεται";setTimeout(cbStart,5000)}}catch(e){S.cbState="δεν υποστηρίζεται"}}

function prune(){const lim=Date.now()-61*6e4;for(const s of SY){const g=S.grp[s];if(g&&Date.now()-g.t1>400)flush(s);const a=S.big[s];while(a.length&&a[0].t<lim)a.shift()}
  if(S.cbGrp&&Date.now()-S.cbGrp.t1>400)cbFlush();while(S.cb.length&&S.cb[0].t<lim)S.cb.shift()}
const sumW=(a,m)=>{const now=Date.now();let b=0,s=0,nb=0,ns=0;for(const x of a){if(now-x.t>m*6e4)continue;if(x.side==="B"){b+=x.v;nb++}else{s+=x.v;ns++}}return {b,s,nb,ns,d:b-s}};

// ---------- εμφάνιση ----------
const F=(t,v,c,sub)=>`<div class="ldF"><div class="t">${t}</div><div class="v ${c||""}">${v}</div>${sub?`<div class="sm" style="margin-top:3px">${sub}</div>`:""}</div>`;
const SEC=t=>`<div class="ldSec">${t}</div>`;
function render(){const el=$("vlBody");if(!el)return;prune();const now=Date.now();
  const cov=m=>now-S.from>=m*6e4*0.95,cbc=m=>now-S.cbFrom>=m*6e4*0.95;
  const cry=SY.filter(s=>!TRAD.has(s));
  // 1. όλη η αγορά (crypto)
  let cur=0,bas=0;for(const s of cry){const b=baseNow(s);if(fin(S.cur[s])&&fin(b)){cur+=S.cur[s];bas+=b}}const mrv=bas>0?cur/bas:NaN;
  const mood=!fin(mrv)?"Φόρτωση…":mrv>=2?"πολύ ζωντανή — μπαίνει πολύς κόσμος":mrv>=1.3?"πιο ζωντανή από το κανονικό":mrv>=0.8?"κανονική":"άδεια — λίγος κόσμος";
  const W=m=>{let b=0,s=0,nb=0,ns=0;for(const x of cry){const r=sumW(S.big[x],m);b+=r.b;s+=r.s;nb+=r.nb;ns+=r.ns}return {b,s,nb,ns,d:b-s}};
  const kp=m=>{const r=W(m);return `<div class="ldF"><div class="t">Μεγάλοι ${m}′${cov(m)?"":" · μερικό"}</div><div class="v ${cl(r.d)}">${sus(r.d)}</div><div class="sm" style="margin-top:3px"><span class="up">αγορ. ${usd(r.b)} (${r.nb})</span><br><span class="dn">πωλ. ${usd(r.s)} (${r.ns})</span></div>${r.b+r.s>0?`<div class="pb" style="margin:6px 0 0"><i style="width:${(r.b/(r.b+r.s)*100).toFixed(0)}%"></i></div>`:""}</div>`};
  // 2. Coinbase έναντι Binance (BTC)
  const cb=sumW(S.cb,15),bn=sumW(S.big.BTCUSDT,15);
  let verdict="—";if(cb.b+cb.s>=5e5&&bn.b+bn.s>=2e6){verdict=Math.sign(cb.d)===Math.sign(bn.d)?(cb.d>0?"✅ Συμφωνούν: οι μεγάλοι αγοράζουν και στο spot (Coinbase) και στα συμβόλαια (Binance)":"✅ Συμφωνούν: οι μεγάλοι πουλάνε και στο spot και στα συμβόλαια"):(bn.d>0?"⚠️ Διαφωνούν: αγορές στα συμβόλαια χωρίς αγορές στο spot → μάλλον μόχλευση, όχι πραγματικά λεφτά":"⚠️ Διαφωνούν: πωλήσεις στα συμβόλαια ενώ το spot αγοράζει → μάλλον hedging/shorts, το spot κρατάει")}
  else if(!cbc(15))verdict="Μαζεύει δεδομένα (θέλει 15′ με τη σελίδα ανοιχτή)";else verdict="Λίγες μεγάλες εκτελέσεις (Coinbase < 500 χιλ. ή Binance < 2 εκ. σε 15′) — καμία καθαρή εικόνα";
  // 3. πίνακας
  const rows=SY.map(s=>{const r=sumW(S.big[s],15),v=S.v15[s],share=v>0?(r.b+r.s)/v:NaN;return {s,rv:rv(s),r,share,thr:S.thr[s]}});
  const crRows=rows.filter(x=>!TRAD.has(x.s)).sort((a,b)=>(fin(b.rv)?b.rv:-1)-(fin(a.rv)?a.rv:-1)),trRows=rows.filter(x=>TRAD.has(x.s));
  const tr=x=>{const whale=cov(15)&&fin(x.share)&&x.share>=0.15&&(x.r.b+x.r.s)>0;
    return `<tr><td><b>${nm(x.s)}</b>${whale?" 🐋":""}</td><td class="${fin(x.rv)&&x.rv>=1.5?"wa":fin(x.rv)&&x.rv<0.7?"mut":""}">${xx(x.rv)}</td><td class="up">${usd(x.r.b)}</td><td class="dn">${usd(x.r.s)}</td><td class="${cl(x.r.d)}">${sus(x.r.d)}</td><td class="mut">${fin(x.share)?Math.round(x.share*100)+"%":"—"}</td><td class="mut">≥${usd(x.thr)}</td></tr>`};
  el.innerHTML=`<div class="ldHero Q" style="padding:14px 15px"><div class="sm mut" style="letter-spacing:1px;text-transform:uppercase">📊 Όγκος όλης της αγοράς crypto · τελευταία 60′ έναντι κανονικού της ώρας</div>
      <div style="display:flex;align-items:baseline;gap:12px;margin-top:6px;flex-wrap:wrap"><div style="font:800 34px ui-monospace,Menlo,monospace" class="${fin(mrv)&&mrv>=1.3?"wa":""}">${xx(mrv)}</div><div style="font-size:15px">${mood}</div></div>
      <div class="sm mut" style="margin-top:4px">${fin(cur)?usd(cur)+" $ σε 60′ · κανονικό ≈ "+usd(bas)+" $":""}</div></div>
    ${SEC("Μεγάλες εκτελέσεις · όλη η αγορά crypto (Binance συμβόλαια)")}
    <div class="ldKp ldK3">${kp(5)}${kp(15)}${kp(60)}</div>
    ${SEC("BTC · Coinbase spot έναντι Binance συμβολαίων (15′)")}
    <div class="ldKp" style="grid-template-columns:repeat(2,minmax(0,1fr))">${F("Coinbase spot · μεγάλοι ≥ "+usd(CB_THR)+" $",sus(cb.d),cl(cb.d),`<span class="up">αγορ. ${usd(cb.b)} (${cb.nb})</span> · <span class="dn">πωλ. ${usd(cb.s)} (${cb.ns})</span>`)}${F("Binance BTC · μεγάλοι ≥ "+usd(S.thr.BTCUSDT||1e5)+" $",sus(bn.d),cl(bn.d),`<span class="up">αγορ. ${usd(bn.b)} (${bn.nb})</span> · <span class="dn">πωλ. ${usd(bn.s)} (${bn.ns})</span>`)}</div>
    <p style="margin:10px 0 0;font-size:14px;line-height:1.45">${verdict}</p>
    ${SEC("Ανά σύμβολο · 15′")}
    <div class="scroll" style="max-height:420px;overflow-y:auto"><table class="ldTb" style="width:100%"><thead><tr><th>Σύμβολο</th><th>Όγκος</th><th>Μεγ. αγορ.</th><th>Μεγ. πωλ.</th><th>Delta</th><th>Μερίδιο</th><th>Όριο</th></tr></thead>
    <tbody>${crRows.map(tr).join("")}<tr><td colspan="7" class="sm mut" style="padding-top:12px">Χρυσός / δείκτες — tokens του Binance, όχι ο όγκος του CME</td></tr>${trRows.map(tr).join("")}</tbody></table></div>
    <p class="sm mut" style="margin:12px 0 0">«Όγκος» = όγκος τελευταίων 60′ έναντι του διάμεσου της ίδιας ώρας τις τελευταίες 14 μέρες (1× = κανονικό). «Μεγάλοι» = εκτελέσεις market ίδιας πλευράς μέσα σε 0,15″, πάνω από το όριο του συμβόλου (ανάλογο με τον όγκο του). «Μερίδιο» = πόσο από τον όγκο του 15λεπτου είναι μεγάλες εκτελέσεις· 🐋 όταν ≥ 15% (όριο χωρίς μέτρηση ακόμα). Η σύγκριση Coinbase/Binance βγάζει συμπέρασμα μόνο με αρκετό όγκο μεγάλων (≥ 500 χιλ. / 2 εκ. σε 15′). Οι μεγάλες εκτελέσεις μετράνε μόνο όσο είναι ανοιχτή η σελίδα · Binance: ${S.wsState} από ${tA(S.from)} · Coinbase: ${S.cbState} από ${tA(S.cbFrom)}. Ανάγνωση, όχι σήμα· δεν μπαίνει στο μοντέλο.${S.err?" · "+S.err:""}</p>`;
  const a=$("vlAt");if(a)a.textContent="· "+tA(now)}

// ---------- σκελετός ----------
const due=(k,ms)=>{const n=Date.now();if(n-(S.T[k]||0)>=ms){S.T[k]=n;return true}return false};
function tick(){if(document.hidden)return;
  if(due("thr",15*6e4))loadThr().catch(e=>{S.err="όρια: "+e.message});
  if(due("base",30*6e4))loadBase().then(render);
  if(due("cur",6e4))loadCur().then(()=>{S.err=null;render()}).catch(e=>{S.err="όγκος: "+e.message});
  if(due("r",3e3))render()}
function build(){const sm=$("smCard"),nav=$("tgNav");const c=document.createElement("div");c.className="card tgx";c.id="vlCard";c.dataset.tab="sum";
  const on=nav&&nav.querySelector("button.on");if(on&&on.dataset.k!=="sum")c.classList.add("tgHide");
  c.innerHTML=`<div class="ldTop"><div class="ldTitle">📊 Volume <b>αγοράς</b></div><span class="ldLive"><i></i>ΖΩΝΤΑΝΟ <span id="vlAt"></span></span></div><div id="vlBody"><p class="sm mut">Φόρτωση…</p></div>`;
  sm.insertAdjacentElement("afterend",c)}
async function boot(){const app=$("app");if(!app||app.style.display==="none"||!$("smCard")||!$("tgNav")){setTimeout(boot,900);return}
  build();try{await loadThr()}catch(e){}wsStart();cbStart();setInterval(tick,1000);document.addEventListener("visibilitychange",()=>{if(!document.hidden){S.T.cur=0;tick()}})}
window.TGV={S,rv,sumW};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
