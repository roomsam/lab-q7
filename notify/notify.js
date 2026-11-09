// TG Πρόβλεψη · ειδοποιήσεις σημάτων στο Discord
// Τρέχει την ΙΔΙΑ σελίδα (index.html + μοντέλα) σε headless Chromium, ώστε τα σήματα να είναι ίδια με της σελίδας.
// Μυστικά από env: TG_KEY (κωδικός μοντέλων), DISCORD_WEBHOOK. Δεν τυπώνονται ποτέ, ούτε σύμβολα/σήματα στο log.
let chromium;try{chromium=require('playwright').chromium}catch(e){chromium=require('playwright-core').chromium}const fs=require('fs');const path=require('path');
const SITE=process.env.SITE_DIR||'.';const STATE=process.env.STATE_FILE||'.notify/state.json';
const KEY=process.env.TG_KEY,HOOK=process.env.DISCORD_WEBHOOK;const DRY=process.env.DRY_RUN==='1';const TEST=process.env.TEST_MSG==='1';
const TFS=['15m','1h','4h','1d'];const EXPER={'15m':true,'1h':true};
const LATE_MS={'15m':5*6e4,'1h':15*6e4,'4h':30*6e4,'1d':120*6e4};const MAXAGE={'15m':45*6e4,'1h':3*36e5,'4h':8*36e5,'1d':36*36e5};
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
if(!KEY){log('λείπει το TG_KEY — τέλος');process.exit(0)}
if(!HOOK&&!DRY){log('λείπει το DISCORD_WEBHOOK — τέλος');process.exit(0)}
// --- state
let S={sent:{},runs:[]};try{S=JSON.parse(fs.readFileSync(STATE,'utf8'))}catch(e){}
S.sent=S.sent||{};S.runs=S.runs||[];
// --- local static server για τα αρχεία της σελίδας
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.enc':'application/json','.png':'image/png'};
const ath=(t,o={})=>new Date(t).toLocaleString('el-GR',Object.assign({timeZone:'Europe/Athens',hour12:false},o));
const hm=t=>ath(t,{hour:'2-digit',minute:'2-digit'});const dt=t=>ath(t,{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const nf=(x)=>!isFinite(x)?'—':x>=1000?x.toLocaleString('el-GR',{maximumFractionDigits:1}):x>=1?x.toLocaleString('el-GR',{maximumFractionDigits:3}):x.toLocaleString('el-GR',{maximumSignificantDigits:4});
const LAB={'15m':"15′",'1h':'1H','4h':'4H','1d':'1D'};
async function post(content){if(DRY){console.log('\n----- MESSAGE -----\n'+content);return true}
  for(let a=0;a<3;a++){try{const r=await fetch(HOOK,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:content.slice(0,1990),username:'TG Σήματα',allowed_mentions:{parse:[]}})});if(r.ok)return true;if(r.status===429){await new Promise(z=>setTimeout(z,2500));continue}log('discord',r.status);return false}catch(e){await new Promise(z=>setTimeout(z,1500))}}return false}
(async()=>{
  const PX=process.env.HTTPS_PROXY||process.env.https_proxy;const br=await chromium.launch(Object.assign(PX?{proxy:{server:PX}}:{},process.env.CHANNEL?{channel:process.env.CHANNEL}:{}));const ctx=await br.newContext({ignoreHTTPSErrors:!!PX});const pg=await ctx.newPage();
  // Οι GitHub runners είναι στις ΗΠΑ: το fapi.binance.com απαντά 451· τα ίδια endpoints σερβίρονται από www.binance.com.
  await pg.route('https://fapi.binance.com/**',async rt=>{const u=rt.request().url().replace('https://fapi.binance.com','https://www.binance.com');try{const r=await rt.fetch({url:u,headers:{'user-agent':'Mozilla/5.0'}});await rt.fulfill({status:r.status(),body:await r.body(),headers:{'content-type':'application/json','access-control-allow-origin':'*'}})}catch(e){await rt.abort()}});
  await pg.route(/fonts\.(googleapis|gstatic)\.com/,rt=>rt.abort());
  await pg.route('https://tg.local/**',async rt=>{const u=new URL(rt.request().url());const f=path.join(SITE,decodeURIComponent(u.pathname).replace(/^\/+/,'')||'index.html');try{await rt.fulfill({status:200,body:fs.readFileSync(f),headers:{'content-type':MIME[path.extname(f)]||'application/octet-stream'}})}catch(e){await rt.fulfill({status:404,body:''})}});
  await pg.goto('https://tg.local/index.html',{waitUntil:'load'});
  const t0=Date.now();
  const out=await pg.evaluate(async({KEY,LIST})=>{
    MODELS=await decrypt(KEY);try{M2C=await decrypt(KEY,'m2c.enc')}catch(e){M2C=null}
    await loadEvents();await prices();const res={tfs:{},err:{},prices:PRICES,events:(EVENTS||[]).map(e=>({t:e.t,title:e.title,country:e.country}))};
    for(const tf of LIST){try{await load(tf)}catch(e){res.err[tf]=String(e.message||e)}}
    for(const tf of LIST){const C=CACHE[tf];if(!C)continue;const M=MODELS[tf],cfg=TFS[tf];
      res.tfs[tf]={latest:C.latest,ms:cfg.ms,N:M.N,k:M.k,thr:THRS[tf],only:cfg.only||null,
        rows:Object.values(C.rows).filter(r=>r.sig&&(!cfg.only||cfg.only.includes(r.s))).map(r=>({s:r.s,sig:r.sig,p:r.p,c:r.c,atr:r.atr})),
        hist:C.hist.filter(h=>h.t>Date.now()-12*864e5).map(h=>({s:h.s,t:h.t,sig:h.sig,p:h.p,c:h.c,atr:h.atr,first:h.first,o:h.o?{how:h.o.how,n:h.o.n,r:h.o.r}:null}))}}
    return res},{KEY,LIST:TFS});
  if(DRY)console.log('ERR',JSON.stringify(out.err));
  if(Object.keys(out.err).length)log('σφάλματα φόρτωσης σε',Object.keys(out.err).length,'timeframes');
  await br.close();
  const now=Date.now();let nNew=0,nOut=0,nLate=0;
  const evTxt=(a,b)=>{const L=out.events.filter(e=>e.t>=a&&e.t<=b);return L.length?'📅 Μέχρι τη λήξη: '+L.slice(0,3).map(e=>`${e.country} ${e.title} (${dt(e.t)})`).join(' · ')+(L.length>3?` +${L.length-3}`:''):'📅 Κανένα γεγονός υψηλού αντίκτυπου μέχρι τη λήξη'};
  if(TEST){const lines=['✅ **Δοκιμαστικό μήνυμα · TG Σήματα**','Η σύνδεση GitHub → Discord δουλεύει.',''];
    for(const tf of TFS){const T=out.tfs[tf];if(!T){lines.push(`${LAB[tf]}: σφάλμα φόρτωσης`);continue}lines.push(`${LAB[tf]}${EXPER[tf]?' 🧪':''}: τελευταίο κερί ${dt(T.latest+T.ms)} · σήματα τώρα: ${T.rows.length}`)}
    lines.push('','Από εδώ και πέρα θα έρχονται μόνο πραγματικά σήματα (κανόνας α: ένα ανοιχτό ανά σύμβολο ανά timeframe).','_Εκπαιδευτικό υλικό — όχι επενδυτική συμβουλή._');await post(lines.join('\n'))}
  const send=async(head,items,foot)=>{let buf=head;const parts=[];for(const it of items){if((buf+'\n'+it).length>1850){parts.push(buf);buf='(συνέχεια)'}buf+='\n'+it}parts.push(buf+'\n'+foot);let ok=true;for(const m of parts)ok=(await post(m))&&ok;return ok};
  for(const tf of TFS){const T=out.tfs[tf];if(!T)continue;const closeAt=T.latest+T.ms,delay=now-closeAt,exp=closeAt+T.N*T.ms;
    // 1) νέα σήματα στο τελευταίο κλεισμένο κερί (κανόνας α), ΕΝΑ μήνυμα ανά κερί
    const fresh=[];if(delay<=MAXAGE[tf])for(const r of T.rows){const h=T.hist.find(x=>x.s===r.s&&x.t===T.latest);if(h&&h.first===false)continue;const id=`${tf}|${r.s}|${T.latest}`;if(S.sent[id])continue;fresh.push([id,r])}
    if(fresh.length){const allSame=T.rows.length;const nUp=T.rows.filter(r=>r.sig>0).length,nDn=T.rows.length-nUp;const lateT=delay>LATE_MS[tf];
      const items=[];const recs=[];
      for(const [id,r] of fresh.sort((a,b)=>Math.abs(b[1].p-0.5)-Math.abs(a[1].p-0.5))){const px=out.prices[r.s];const d=isFinite(px)?(px-r.c)/r.atr*r.sig:NaN;const late=lateT||(isFinite(d)&&Math.abs(d)>0.25);
        const up=r.sig>0,tp=r.c+r.sig*T.k*r.atr,sl=r.c-r.sig*T.k*r.atr,prob=up?r.p:1-r.p;const nm=r.s.replace('USDT','');
        items.push(`${late?'🕓':up?'🟢':'🔴'} ${up?'ΑΓΟΡΑ':'ΠΩΛΗΣΗ'} **${nm}** ${nf(r.c)} → 🎯 ${nf(tp)} · 🛑 ${nf(sl)} · ${Math.round(prob*100)}% · τώρα ${isFinite(d)?(d>=0?'+':'')+d.toFixed(2).replace('.',','):'—'} ATR ${late?'⛔ εκπρόθεσμο':'✅'}`+((nm==='XAU'&&new Date(closeAt).getUTCDay()===6)?' · Σ/Κ: CFD κλειστό':''));
        recs.push([id,{tf,s:r.s,t:T.latest,ms:T.ms,sig:r.sig,c:r.c,atr:r.atr,k:T.k,N:T.N,at:now,delay,late,d:isFinite(d)?+d.toFixed(3):null,cl:Math.max(nUp,nDn)}])}
      const nLateHere=recs.filter(x=>x[1].late).length;const big=Math.max(nUp,nDn);
      const head=[`📣 **${LAB[tf]} · κερί που έκλεισε ${dt(closeAt)}**`+(EXPER[tf]?' · 🧪 ΠΕΙΡΑΜΑΤΙΚΟ (χωρίς έλεγχο με κόστη)':''),
        `${fresh.length} νέ${fresh.length===1?'ο σήμα':'α σήματα'} · ⏱️ καθυστέρηση ${Math.round(delay/6e4)}′${lateT?' (αργά — όλα για καταγραφή)':''}${nLateHere&&!lateT?` · ${nLateHere} έχουν ήδη φύγει >0,25 ATR`:''}`,
        big>=8?`⚠️ **ΣΥΣΤΑΔΑ ${big} σημάτων ${nUp>=nDn?'ΑΓΟΡΑΣ':'ΠΩΛΗΣΗΣ'}** = ένα στοίχημα στην αγορά, όχι ${big} ξεχωριστά. Ιστορικά 2025–26 οι συστάδες ≥8 ήταν αρνητικές (−0,01 έως −0,06R/σήμα).`:big>=4?`ℹ️ ${big} σήματα ίδιας κατεύθυνσης — συσχετισμένα.`:''].filter(Boolean).join('\n');
      const foot=[`⏳ Λήξη ${dt(exp)} (${T.N} κεριά) · στόχος/stop ±${T.k} ATR από την αναφορά (= κλείσιμο, τιμή αναφοράς)`,evTxt(closeAt,exp),'Ισχύει μόνο όσο η τιμή είναι σε ±0,25 ATR από την αναφορά.','_Εκπαιδευτικό υλικό — όχι επενδυτική συμβουλή._'].join('\n');
      if(await send(head,items,foot)){for(const [id,v] of recs)S.sent[id]=v;nNew+=recs.length;nLate+=nLateHere}}
    // 2) εκβάσεις: ΕΝΑ μήνυμα ανά timeframe ανά εκτέλεση
    const outs=[],ids=[];
    for(const id in S.sent){const e=S.sent[id];if(e.tf!==tf||e.done)continue;const h=T.hist.find(x=>x.s===e.s&&x.t===e.t);if(!h||!h.o)continue;const o=h.o;
      const win=(o.how==='up'&&e.sig>0)||(o.how==='dn'&&e.sig<0);const R=o.how==='exp'?e.sig*o.r/(e.atr/e.c):win?1:-1;const b0=e.t+o.n*e.ms,b1=b0+e.ms;const nm=e.s.replace('USDT','');
      const res=o.how==='exp'?`⏳ Έληξε χωρίς στόχο/stop (${R>=0?'+':''}${R.toFixed(2).replace('.',',')}R)`:win?`✔ Στόχος στο κερί ${hm(b0)}–${hm(b1)} (+1R)`:o.how==='both'?`✖ Stop στο κερί ${hm(b0)}–${hm(b1)} (στόχος+stop στο ίδιο κερί → stop) (−1R)`:`✖ Stop στο κερί ${hm(b0)}–${hm(b1)} (−1R)`;
      outs.push(`${res} · ${e.sig>0?'ΑΓΟΡΑ':'ΠΩΛΗΣΗ'} **${nm}** από ${dt(e.t+e.ms)} (αναφορά ${nf(e.c)})${e.late?' · ήταν εκπρόθεσμο':''}`);ids.push([id,{how:o.how,n:o.n,R:+R.toFixed(3),at:now}])}
    if(outs.length){const sumR=ids.reduce((a,x)=>a+x[1].R,0);if(await send(`🏁 **${LAB[tf]} · εκβάσεις** (${outs.length} · σύνολο ${sumR>=0?'+':''}${sumR.toFixed(2).replace('.',',')}R)`,outs,'_Πριν από κόστη. Εκπαιδευτικό υλικό._')){for(const [id,d] of ids)S.sent[id].done=d;nOut+=ids.length}}}
  // καθάρισμα και καταγραφή εκτέλεσης (χωρίς σύμβολα)
  for(const id in S.sent)if(now-S.sent[id].at>21*864e5)delete S.sent[id];
  S.runs.push({at:now,ms:Date.now()-t0,new:nNew,out:nOut,late:nLate,err:Object.keys(out.err)});S.runs=S.runs.slice(-3000);
  fs.mkdirSync(path.dirname(STATE),{recursive:true});fs.writeFileSync(STATE,JSON.stringify(S));
  log(`ok · νέα ${nNew} · εκβάσεις ${nOut} · εκπρόθεσμα ${nLate} · σφάλματα ${Object.keys(out.err).length} · ${Math.round((Date.now()-t0)/1000)}s`);
})().catch(e=>{log('σφάλμα',String(e&&e.message||e).slice(0,200));process.exit(1)});
