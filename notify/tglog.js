// TG Πρόβλεψη · καταγραφή στο ιδιωτικό Sheet (μέσω Apps Script). Δεν στέλνει τίποτα αν λείπουν TG_LOG_URL / TG_LOG_TOKEN.
// Ό,τι κι αν συμβεί εδώ, δεν σταματά τις ειδοποιήσεις: ο notifier το καλεί μέσα σε try/catch.
const fs=require("fs"),path=require("path");
const {TGSUM}=require(path.join(__dirname,"..","tgsum.js"));
const VERS="μηχανή 2.6 · notifier 3 · "+TGSUM.VER;
const HLW=["0x5b5d51203a0f9079f8aeb098a6523a13f298c060","0xb83de012dba672c76a7dbbbf3e459cb59d7d6e36","0xfc27136e42af1732ddc9ce2605ea9bff1b959d9d","0xdf954bbe619273a56e0cfa90dad8382195dc7d72","0xb695651daa495f59dd2725c6fe98322d8b51a92d","0x8ea85cbd59affca28162fc286d5c093dd0f8edbc","0x218a65e21eddeece7a9df38c6bbdd89f692b7da2","0x45d26f28196d226497130c4bac709d808fed4029","0x15a4f009bb324a3fb9e36137136b201e3fe0dfdb","0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00","0xe81309ec9b79309e4d108ae3a92d1aa618cd6d74","0xca4903c207a0df58bf37d4bc8bbc5210726f53c8","0x93ab7dbdeb996806454de19c35c8247f4b2511f8","0xf517639a8872e756ac98d3c65507d2ebc25cc032","0x1bbfb3a33600338d5a948618189649a4588d5fc4","0x3dc908374e11623d8eb9f07dfc7a2e5e803a54b0","0x64b766b07362405a9cc19c2226490f3015929da9","0x237152b038d88f4156a0cd71090462de7e3f0883","0x7fdafde5cfb5465924316eced2d3715494c517d1","0x519c721de735f7c9e6146d167852e60d60496a47","0xfc667adba8d4837586078f4fdcdc29804337ca06","0xba5d9cc840745aeeeeedac5712e32f13ab8ea352","0x939f95036d2e7b6d7419ec072bf9d967352204d2","0xea0027b6ea9b6d7d401b5266979cc3b3ca87a918","0x6859da14835424957a1e6b397d8026b1d9ff7e1e","0x9c89f595f5515609ad61f6fda94beff85ae6600e","0xf02d028ffeddc120a3ec59602a6617303ca55eb3","0xcf5343ba750a6e30afbb1dadda08bc78f8c8ee11","0xfe7ce058edc7cfcde9ef8262ba51f8d4796ab7ae","0xb581d667c53fd8a50bf7ffd817be0e62daa16f4f","0xebe126adabe1a8f08d3ce53b45e7cc994ca14070","0x023a3d058020fb76cca98f01b3c48c8938a22355","0x92cbb22a9b9fc01da9914c9b39ed904dd61b859c","0x77eeda199553e33b246e4b4666849b9ad0972902","0x8cc94dc843e1ea7a19805e0cca43001123512b6a","0x936cf4fb95c30ce83f658b5bbb247e4bb381bb0f","0x8607a7d180de23645db594d90621d837749408d5","0x9aa589355bf745db9784c8ef3c646360f11b58af","0x007d76eec0ba411ce873a8819df50dd443d967a0","0x3fc56e944aa7b1594c85861b2d46a07f82a2c0c1"];
const TYP={watch:"φόρτωμα",entry:"είσοδος",exh:"εξασθένηση",end:"τέλος",fade:"ακύρωση",sweep:"σκούπισμα"};
const fmt=ms=>new Date(ms).toLocaleString("sv-SE",{timeZone:"Europe/Athens",hour12:false});
const r=(v,d)=>Number.isFinite(v)?+v.toFixed(d):"";
const nm=s=>s.replace("USDT","");

// Επεισόδια: ένα ID ανά φόρτωμα, κοινό για ξανά/επιβεβαίωση/είσοδο/εξασθένηση/τέλος.
function episodes(out,st){const cur={},res={};st.ep=st.ep||{};st.epOpen=st.epOpen||{};
  for(const e of out.ev){if(e.type==="open")continue;const s=e.dir,key=e.type+"|"+e.dir+"|"+e.t;let seq;
    if(e.type==="watch"){if(!cur[s]){cur[s]=(s>0?"L ":"S ")+fmt(e.t+3e5).slice(0,16);seq="πρώτη"}else seq=e.re?"επανάληψη "+e.re:/επιβεβαιώνει/.test(e.label)?"επιβεβαίωση":"επανάληψη"}
    else{if(!cur[s])cur[s]=st.epOpen[s]||((s>0?"L ":"S ")+"πριν "+fmt(e.t+3e5).slice(0,16));seq=TYP[e.type]}
    res[key]={id:st.ep[key]||cur[s],seq};st.ep[key]=res[key].id;
    if(e.type==="fade"||(e.type==="end"&&!/η βάση κρατάει/.test(e.label)))cur[s]=null}
  st.epOpen={};for(const s of [1,-1])if(cur[s])st.epOpen[s]=cur[s];return {res,cur}}

module.exports=async function tglog(c){const {D,out,st,now,pNow,sweeps,API,j}=c;const URL=process.env.TG_LOG_URL,TOK=process.env.TG_LOG_TOKEN,DRY=!!process.env.DRY_RUN;
  const call=async b=>{if(!URL||!TOK){if(DRY)console.log("LOG(dry)",b.op||b.sheet,(b.rows||[]).length,JSON.stringify((b.rows||[])[0]||{}).slice(0,600));return {ok:true,dry:true}}
    const res=await fetch(URL,{method:"POST",headers:{"content-type":"text/plain;charset=utf-8"},body:JSON.stringify(Object.assign({token:TOK},b)),redirect:"follow"});const t=await res.text();try{return JSON.parse(t)}catch(e){throw new Error("apps script: "+t.slice(0,120))}};
  const stats={ev:0,out:0,snap:0,sum:0,err:[]};const safe=async(name,f)=>{try{await f()}catch(e){stats.err.push(name+": "+e.message)}};
  st.seen=st.seen||{};st.sentP=st.sentP||{};st.logged=st.logged||{};
  if((!URL||!TOK)&&!DRY){for(const e of out.ev){if(e.type==="open")continue;const k=e.type+"|"+e.dir+"|"+e.t;if(!st.seen[k])st.seen[k]={d:now,p:pNow}}return {disabled:"χωρίς TG_LOG_URL/TG_LOG_TOKEN"}}
  if(!st.logStart)st.logStart=now;
  const {res:EP,cur}=episodes(out,st);
  // 1. συμβάντα
  await safe("συμβάντα",async()=>{const rows=[];
    for(const e of out.ev){if(e.type==="open")continue;const key=e.type+"|"+e.dir+"|"+e.t;const close=e.t+3e5;
      if(!st.seen[key])st.seen[key]={d:now,p:pNow};if(close<st.logStart-15*6e4)continue;
      const sent=st.sent[key],state=sent?"sent":"seen";if(st.logged[key]===state||st.logged[key]==="sent")continue;
      const sn=st.seen[key],arr=sent?sent:sn.d,parr=sent?(st.sentP[key]||sn.p):sn.p,m=e.m||{},ep=EP[key]||{};
      rows.push({key,"επεισόδιο":ep.id||"","σειρά":ep.seq||"","τύπος":TYP[e.type]||e.type,"πλευρά":e.dir>0?"L":"S","ετικέτα":e.label,"πρώιμο":e.w==="πρώιμο"?"ναι":"όχι",
        "σύμβολα_n":e.n||(e.list?e.list.length:""),"σύμβολα":(e.syms||(e.list||[]).map(z=>z.s)).map(nm).join(", "),"κερί_κλείσιμο":fmt(close),"ανίχνευση":fmt(sn.d),"αποστολή":sent?fmt(sent):"",
        "καθυστέρηση_λ":r((arr-close)/6e4,1),"στάλθηκε":sent?"ναι":"όχι","τιμή_κεριού":r(e.px,2),"τιμή_αναφοράς":r(parr,2),"αναφορά_ms":arr,"αναφορά_από":sent?"αποστολή":"ανίχνευση","άκρη":r(e.edge,2),
        "OI_αγοράς_30":r(m.moi*100,3),"αγορ_πωλ_30":r(m.tk,3),"μεγάλοι_up":r(m.topUp,2),"λιανική_down":r(m.retDn,2),"έχει_τρέξει_ATR":r(m.ext,2),"ιστορική_έρευνα":e.score||"","έκδοση":VERS,_st:state})}
    for(const w of sweeps||[]){const key=w.key;if(st.logged[key])continue;rows.push({key,"επεισόδιο":"⚡ "+fmt(w.t+3e5).slice(0,16),"σειρά":"⚡","τύπος":"σκούπισμα","πλευρά":w.dir>0?"L":"S",
      "ετικέτα":w.lab,"πρώιμο":"όχι","σύμβολα_n":w.list.length,"σύμβολα":w.list.map(nm).join(", "),"κερί_κλείσιμο":fmt(w.t+3e5),"ανίχνευση":fmt(w.sent),"αποστολή":fmt(w.sent),
      "καθυστέρηση_λ":r((w.sent-w.t-3e5)/6e4,1),"στάλθηκε":"ναι","τιμή_κεριού":r(w.px,2),"τιμή_αναφοράς":r(w.p,2),"αναφορά_ms":w.sent,"αναφορά_από":"αποστολή","άκρη":r(w.edge,2),"έκδοση":VERS,_st:"sent"})}
    if(!rows.length)return;const states=rows.map(x=>[x.key,x._st]);rows.forEach(x=>delete x._st);
    const a=await call({op:"upsert",sheet:"Συμβάντα",rows});if(!a.ok)throw new Error(a.err);for(const [k,s] of states)st.logged[k]=s;stats.ev=rows.length});
  // 2. αποτελέσματα από την τιμή άφιξης
  await safe("αποτελέσματα",async()=>{const p=await call({op:"pending",horizons:[30,60,120,240]});if(!p.ok||!p.rows)return;const rows=[];
    for(const q of p.rows.slice(0,25)){const t0=Math.floor(q.ms/6e4)*6e4+6e4,mx=Math.max(240,...q.miss);const k=await j(`${API}/fapi/v1/klines?symbol=BTCUSDT&interval=1m&startTime=${t0}&limit=${Math.min(1000,mx+2)}`);
      const B=k.map(x=>({t:+x[0],h:+x[2],l:+x[3],c:+x[4]}));const dir=q.dir==="S"?-1:1,p0=+q.p0;if(!(p0>0))continue;const o={key:q.key};
      for(const h of q.miss){const end=q.ms+h*6e4,z=B.filter(b=>b.t+6e4<=end);if(!z.length||z[z.length-1].t+6e4<end-6e4)continue;
        const c=z[z.length-1].c,hi=Math.max(...z.map(b=>b.h)),lo=Math.min(...z.map(b=>b.l));
        o["τιμή_"+h]=r(dir*(c/p0-1)*100,3);o["υπέρ_"+h]=r((dir>0?hi/p0-1:1-lo/p0)*100,3);o["κατά_"+h]=r((dir>0?1-lo/p0:hi/p0-1)*100,3)}
      // κύρια μέτρηση (ορισμένη από πριν): +0,5% υπέρ πριν −0,5% κατά, μέσα σε 240′ από την τιμή αναφοράς
      if(q.prim){const end=q.ms+240*6e4;let res="";for(const b of B){if(b.t+6e4>end)break;const fav=dir>0?b.h/p0-1:1-b.l/p0,adv=dir>0?1-b.l/p0:b.h/p0-1;
          if(fav>=0.005&&adv>=0.005){res="όχι";}else if(fav>=0.005)res="ναι";else if(adv>=0.005)res="όχι";if(res){o["κύρια_μέτρηση"]=res;o["κύρια_λεπτά"]=Math.round((b.t+6e4-q.ms)/6e4);break}}
        if(!res&&B.length&&B[B.length-1].t+6e4>=end-6e4&&now>=end){o["κύρια_μέτρηση"]="καμία";o["κύρια_λεπτά"]=240}}
      if(Object.keys(o).length>1)rows.push(o)}
    if(rows.length){const a=await call({op:"upsert",sheet:"Συμβάντα",rows});if(!a.ok)throw new Error(a.err);stats.out=rows.length}});
  // 3. στιγμιότυπο 5′ (με δηλωμένη κάλυψη)
  const slot=Math.floor(now/3e5)*3e5;let SK=null,FK=null;
  await safe("στιγμιότυπο",async()=>{if(st.snapSlot===slot)return;const B=D.BTCUSDT,N=out.N,J=B.c.length-1;const g=async u=>{try{return await j(u)}catch(e){return null}};
    const [fk,sk,ta,bk,ag,cb,sp]=await Promise.all([g(`${API}/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=61`),g(`${API}/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=61`),g(`${API}/futures/data/topLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1`),
      g(`${API}/fapi/v1/depth?symbol=BTCUSDT&limit=1000`),g(`${API}/fapi/v1/aggTrades?symbol=BTCUSDT&limit=1000`),g("https://api.exchange.coinbase.com/products/BTC-USD/ticker"),g(`${API}/api/v3/ticker/price?symbol=BTCUSDT`)]);
    FK=fk;SK=sk;const done=a=>(a||[]).filter(x=>+x[0]+6e4<=now),dl=(a,n)=>done(a).slice(-n).reduce((s,x)=>s+2*+x[10]-+x[7],0),tk=(a,n)=>{const z=done(a).slice(-n);const b=z.reduce((s,x)=>s+ +x[10],0),q=z.reduce((s,x)=>s+ +x[7],0);return q-b>0?b/(q-b):NaN};
    let bookPct="",band="";if(bk&&bk.bids&&bk.asks){const Bd=bk.bids.map(x=>[+x[0],+x[0]*+x[1]]),As=bk.asks.map(x=>[+x[0],+x[0]*+x[1]]),mid=(Bd[0][0]+As[0][0])/2,bw=Math.min((mid-Bd[Bd.length-1][0])/mid,(As[As.length-1][0]-mid)/mid);
      const sb=Bd.filter(x=>(mid-x[0])/mid<=bw).reduce((s,x)=>s+x[1],0),sa=As.filter(x=>(x[0]-mid)/mid<=bw).reduce((s,x)=>s+x[1],0);bookPct=r(sb/(sb+sa)*100,1);band=r(bw*100,3)}
    let bb="",bs="",cov="";if(ag&&ag.length){const G=[];let gp=null;for(const x of ag){const t=+x.T,side=x.m?"S":"B",v=+x.p*+x.q;if(gp&&gp.side===side&&t-gp.t1<=150){gp.v+=v;gp.t1=t}else{if(gp)G.push(gp);gp={side,t1:t,v}}}if(gp)G.push(gp);
      const big=G.filter(x=>x.v>=5e5);bb=r(big.filter(x=>x.side==="B").reduce((s,x)=>s+x.v,0),0);bs=r(big.filter(x=>x.side==="S").reduce((s,x)=>s+x.v,0),0);cov=r((+ag[ag.length-1].T-+ag[0].T)/1000,0)}
    let pc="";if(cb&&cb.price&&sp&&sp.price)pc=r((+cb.price/+sp.price-1)*100,4);
    let dpc="";await (async()=>{const d=await g("https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option");if(!d||!d.result)return;let P=0,C=0;for(const x of d.result){const m=x.instrument_name.match(/-([CP])$/);if(!m)continue;if(m[1]==="P")P+=+x.open_interest||0;else C+=+x.open_interest||0}if(C)dpc=r(P/C,3)})();
    let hln="",hlok="";if(Math.floor(now/6e4)%15<5){let net=0,ok=0;for(let i=0;i<HLW.length;i+=10){const rs=await Promise.all(HLW.slice(i,i+10).map(a=>fetch("https://api.hyperliquid.xyz/info",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"clearinghouseState",user:a})}).then(x=>x.ok?x.json():null).catch(()=>null)));
      for(const q of rs){if(!q)continue;ok++;for(const p of q.assetPositions||[])if(p.position.coin==="BTC")net+=Math.sign(+p.position.szi)*Math.abs(+p.position.positionValue)}}if(ok){hln=r(net,0);hlok=ok}}
    const SS=out.SS[N-1]||{},M=out.M[N-1]||{};let ld=0,ab=0,lq=0;for(const s in SS){if(c.EXCL.has(s))continue;const t=SS[s].st;if(t==="load")ld++;else if(t==="absorb"||t==="absorbliq"||t==="transfer")ab++;else if(t==="liq")lq++}
    const eng=out.ev.filter(e=>e.type==="open").map(e=>(e.phase==="move"?"κίνηση ":"παρακολούθηση ")+(e.dir>0?"L":"S")).join("+")||"ήσυχα";
    const row={"ώρα":fmt(slot),ms:slot,BTC:r(pNow,2),"OI_BTC":r(B.oi[J],0),"OI_BTC_15":r((B.oi[J]/B.oi[J-3]-1)*100,3),perp_delta_5:r(dl(fk,5),0),perp_delta_15:r(dl(fk,15),0),perp_delta_60:r(dl(fk,60),0),
      spot_delta_5:sk?r(dl(sk,5),0):"",spot_delta_15:sk?r(dl(sk,15),0):"",spot_delta_60:sk?r(dl(sk,60),0):"","αγορ_πωλ_15":r(tk(fk,15),3),"μεγάλοι_θέσεις":r(B.top[J]*100,2),"μεγάλοι_λογαριασμοί":ta&&ta[0]?r(+ta[0].longAccount*100,2):"",
      "λιανική":r(B.ret[J]*100,2),coinbase_premium:pc,"βιβλίο_αγορές_ποσοστό":bookPct,"βιβλίο_εύρος":band,"μεγάλες_εκτ_αγορές":bb,"μεγάλες_εκτ_πωλήσεις":bs,"εκτ_κάλυψη_δευτ":cov,"ρευστοποιήσεις":"δεν καλύπτεται",
      deribit_put_call:dpc,"hl_καθαρό_BTC":hln,"hl_πορτοφόλια":hlok,"καλάθι_φορτώνουν":ld,"καλάθι_απορρόφηση":ab,"καλάθι_ρευστοποίηση":lq,"OI_αγοράς_30":r(M.moi*100,3),"αγορ_πωλ_30":r(M.tk,3),"μηχανή":eng,"έκδοση":VERS};
    const a=await call({op:"upsert",sheet:"Στιγμιότυπα",rows:[row]});if(!a.ok)throw new Error(a.err);st.snapSlot=slot;stats.snap=1});
  // 4. σύνοψη: πρώτη ανά επεισόδιο και κάθε ουσιαστική αλλαγή
  await safe("σύνοψη",async()=>{const A=TGSUM.anchor(now);const k1=await j(`${API}/fapi/v1/klines?symbol=BTCUSDT&interval=1m&startTime=${A.t-6e4}&limit=1000`);
    const oh=await j(`${API}/futures/data/openInterestHist?symbol=BTCUSDT&period=5m&limit=150`);const s1=SK||await j(`${API}/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=61`);
    let events=[];try{events=(JSON.parse(fs.readFileSync(path.join(__dirname,"..","events.json"),"utf8")).events||[]).map(e=>({...e,t:Date.parse(e.date)})).filter(e=>Number.isFinite(e.t))}catch(e){}
    const x=TGSUM.fromRaw({now,k1,s1,oih:oh.map(z=>({t:+z.timestamp,v:+z.sumOpenInterest})),eng:{out,excl:c.EXCL},events});const s=TGSUM.build(x);if(!s)return;
    const epNow=[cur[1],cur[-1]].filter(Boolean).join(" + ");const sig=s.tags+"|"+epNow;if(st.sumSig===sig)return;const L=TGSUM.text(s);
    const row={"ώρα":fmt(now),ms:Math.floor(now/6e4)*6e4,"επεισόδιο":epNow,"ετικέτες":s.tags,"γραμμή_1":L[0]||"","γραμμή_2":L[1]||"","γραμμή_3":L[2]||"","γραμμή_4":L[3]||"",
      "επίπεδα":s.levels.map(v=>`${v.side} ${TGSUM.px(v.p)} (${v.lab})`).join(" · "),"μερικά":s.partial.join(" · "),BTC:r(s.px,2),"έκδοση_κανόνων":VERS};
    const a=await call({op:"upsert",sheet:"Σύνοψη",rows:[row]});if(!a.ok)throw new Error(a.err);st.sumSig=sig;stats.sum=1});
  for(const o of [st.seen,st.sentP,st.ep,st.logged])for(const k in o){const t=+k.split("|")[2];if(t&&now-t>2*864e5)delete o[k]}
  return stats};
module.exports.episodes=episodes;module.exports.fmt=fmt;
