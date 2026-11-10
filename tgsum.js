// TG Πρόβλεψη · Σύνοψη. Ίδιοι κανόνες στη σελίδα και στον notifier (για να μετριέται ό,τι βλέπεις).
// Κανόνες: δεν ανακατεύει BTC με καλάθι, ούτε «από το άνοιγμα» με «τελευταία 15′». Γράφει πρώτα τη μέτρηση, μετά την πιθανή ανάγνωση.
(function(root){
"use strict";
const VER="σύνοψη-1";
const fin=Number.isFinite;
const p2=(v,d)=>!fin(v)?"—":(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(d===undefined?2:d).replace(".",",")+"%";
const usd=v=>{if(!fin(v))return"—";const a=Math.abs(v),s=v>0?"+":v<0?"−":"";return s+(a>=1e9?(a/1e9).toFixed(2).replace(".",",")+" δισ.":a>=1e6?(a/1e6).toFixed(a>=1e7?0:1).replace(".",",")+" εκ.":a>=1e3?Math.round(a/1e3)+" χιλ.":Math.round(a)+"")};
const px=v=>!fin(v)?"—":Math.round(v).toLocaleString("el-GR");
const tA=t=>new Date(t).toLocaleTimeString("el-GR",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Europe/Athens"});
const TH={oi:0.3,oi60:0.15,flow:5e6,px15:0.05};

// ---------- ανοίγματα (ίδια με το φύλλο «Άνοιγμα») ----------
function zoned(zone,h,m,now,dayOff){const t0=now+dayOff*864e5;const p=new Intl.DateTimeFormat("en-US",{timeZone:zone,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).formatToParts(new Date(t0)).reduce((a,x)=>(a[x.type]=x.value,a),{});
  const asUTC=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute);const off=asUTC-Math.floor(t0/6e4)*6e4;return Date.UTC(+p.year,+p.month-1,+p.day,h,m)-off}
const OPENS=[["Τόκιο","Asia/Tokyo",9,0],["Λονδίνο","Europe/London",8,0],["δεδομένα ΗΠΑ","America/New_York",8,30],["άνοιγμα ΗΠΑ","America/New_York",9,30]];
function anchor(now){let best=null;for(const [n,z,h,m] of OPENS)for(const d of [0,-1]){const t=zoned(z,h,m,now,d);if(t<=now&&(!best||t>best.t))best={n,t}}
  if(!best||now-best.t>11.5*36e5)return {n:"τελευταία 60′",t:Math.floor((now-36e5)/6e4)*6e4};return best}

// ---------- από ακατέργαστα δεδομένα Binance ----------
// k1: κεριά 1′ συμβολαίων BTC (πίνακες Binance), από πριν το άνοιγμα έως τώρα · s1: κεριά 1′ spot BTC (≥60) · oih:[{t,v}] OI 5′ (συμβόλαια BTC)
// eng: έξοδος TGLOAD.run (προαιρετικό) · excl: Set συμβόλων εκτός καλαθιού · events:[{t,title,country}] · now
function fromRaw(o){const now=o.now||Date.now();const A=anchor(now);const part=[];
  const K=(o.k1||[]).map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],q:+x[7],tb:+x[10]})).filter(b=>b.t+6e4<=now+1000);
  const SP=(o.s1||[]).map(x=>({t:+x[0],q:+x[7],tb:+x[10]})).filter(b=>b.t+6e4<=now+1000);
  const OI=(o.oih||[]).slice().sort((a,b)=>a.t-b.t);
  const oiAt=t=>{let b=null;for(const x of OI)if(x.t<=t+6e4)b=x;return b?b.v:NaN};
  const dl=(arr,n)=>arr.slice(-n).reduce((a,b)=>a+2*b.tb-b.q,0);
  const x={t:now,ver:VER};if(!K.length)return null;const last=K[K.length-1];x.px=last.c;
  const win=K.filter(b=>b.t>=A.t);
  if(win.length>=2){const o0=oiAt(A.t),o1=OI.length?OI[OI.length-1].v:NaN;x.open={n:A.n,t:A.t,pxD:(last.c/win[0].o-1)*100,oiD:o0>0&&fin(o1)?(o1/o0-1)*100:NaN,delta:win.reduce((a,b)=>a+2*b.tb-b.q,0),px0:win[0].o}}
  else part.push("άνοιγμα: λιγότερα από 2′");
  const o60=oiAt(now-36e5),o15=oiAt(now-15*6e4),oN=OI.length?OI[OI.length-1].v:NaN;
  x.h1={perp:dl(K,60),spot:SP.length>=55?dl(SP,60):NaN,oi:o60>0?(oN/o60-1)*100:NaN};
  x.m15={perp:dl(K,15),spot:SP.length>=15?dl(SP,15):NaN,px:K.length>15?(last.c/K[K.length-16].c-1)*100:NaN,oi:o15>0?(oN/o15-1)*100:NaN};
  if(SP.length<55)part.push(`spot: ${SP.length}/60′`);
  const k60=K.slice(-60);x.lv={hi60:Math.max(...k60.map(b=>b.h)),lo60:Math.min(...k60.map(b=>b.l)),open:x.open?x.open.px0:NaN};
  const E=o.eng;if(E&&E.out){const out=E.out,N=out.N,SS=out.SS[N-1]||{},M=out.M[N-1]||{};const ex=E.excl||new Set();let load=0,abs=0,liq=0,n=0;
    for(const s in SS){if(ex.has(s))continue;n++;const st=SS[s].st;if(st==="load")load++;else if(st==="absorb"||st==="absorbliq"||st==="transfer")abs++;else if(st==="liq")liq++}
    x.bk={load,abs,liq,n,moi:M.moi*100,tk:M.tk};const op=out.ev.filter(e=>e.type==="open");
    x.eng=op.map(e=>({dir:e.ep.dir,ph:e.phase,base:e.ep.base,edge:e.ep.edge,early:e.ep.k==="xfer"||e.ep.k==="dist"}))}
  else part.push("καλάθι: δεν φόρτωσε ακόμα");
  x.news=(o.events||[]).filter(e=>e.t>=now-30*6e4&&e.t<=now+6*36e5).slice(0,2);
  x.part=part.concat(o.partial||[]);return x}

// ---------- κείμενο ----------
const sg=v=>!fin(v)?0:v>0?1:v<0?-1:0;
const fsg=v=>!fin(v)||Math.abs(v)<TH.flow?0:v>0?1:-1;
function build(x){if(!x)return null;const L=[],tags=[];
  // 1. από το άνοιγμα (μόνο BTC, μόνο αυτό το παράθυρο)
  if(x.open){const o=x.open,oc=!fin(o.oiD)?"?":o.oiD<=-TH.oi?"↓":o.oiD>=TH.oi?"↑":"=";const mv=o.pxD>0?"Η άνοδος":"Η πτώση";
    const rd=oc==="↓"?`${mv} συνοδεύεται από πτώση του OI.`:oc==="↑"?`${mv} συνοδεύεται από άνοδο του OI.`:oc==="="?"Το OI δεν έχει αλλάξει ουσιαστικά.":"";
    L.push(`<b>Από ${o.n} ${tA(o.t)}</b> · BTC ${p2(o.pxD)}, OI ${p2(o.oiD)}, delta ${usd(o.delta)} · ${rd}`);tags.push("o"+sg(o.pxD)+oc)}
  // 2. τελευταία ώρα (BTC)
  const h=x.h1,f60=fsg(h.perp);{let rd="";const oc=!fin(h.oi)?0:h.oi<=-TH.oi60?-1:h.oi>=TH.oi60?1:0;
    if(f60>0&&oc<0)rd="60′: πιθανή κάλυψη shorts (δεν δείχνει πόση από την άνοδο).";else if(f60>0&&oc>0)rd="60′: πιθανά νέα longs.";else if(f60<0&&oc<0)rd="60′: πιθανό κλείσιμο longs.";else if(f60<0&&oc>0)rd="60′: πιθανά νέα shorts.";
    L.push(`<b>Τελευταία ώρα</b> · delta συμβόλαια ${usd(h.perp)}, spot ${usd(h.spot)}, OI BTC ${p2(h.oi)}. ${rd}`);tags.push("h"+f60+oc)}
  // 3. τελευταία 15′ (BTC) — μόνο αν λέει κάτι διαφορετικό από την ώρα
  const m=x.m15,fp=fsg(m.perp),fs=fsg(m.spot);let l3="";
  if(fp&&fs&&fp!==fs)l3=`<b>Τελευταία 15′</b> · μικτή εικόνα: συμβόλαια ${usd(m.perp)}, spot ${usd(m.spot)}, τιμή ${p2(m.px)}.`;
  else if(fp&&fp!==f60&&f60){const hold=fin(m.px)&&(fp<0?m.px>=-TH.px15:m.px<=TH.px15);
    l3=`<b>Τελευταία 15′</b> · delta συμβόλαια ${usd(m.perp)}, spot ${usd(m.spot)}, τιμή ${p2(m.px)}. `+(hold?`${fp<0?"Πωλήσεις":"Αγορές"} με τιμή που κρατά: πιθανή απορρόφηση ή εξασθένηση της ροής της ώρας.`:`Η ροή της ώρας ${fp<0?"γύρισε αρνητική":"γύρισε θετική"} και η τιμή ακολούθησε.`)}
  else if(sg(m.px)&&fp&&sg(m.px)!==fp&&Math.abs(m.px)>=TH.px15)l3=`<b>Τελευταία 15′</b> · μικτή εικόνα: τιμή ${p2(m.px)} ενώ delta συμβολαίων ${usd(m.perp)}.`;
  else if(!fp&&f60)l3=`<b>Τελευταία 15′</b> · η ροή σταμάτησε (συμβόλαια ${usd(m.perp)}, spot ${usd(m.spot)}).`;
  if(l3)L.push(l3);tags.push("m"+fp);
  // 4. ευρύτερη αγορά (καλάθι 22 crypto, χωριστά από το BTC)
  if(x.bk){const b=x.bk;const dom=b.load>=b.liq?["long",b.load]:["ρευστοποίηση",b.liq];
    L.push(`<b>Ευρύτερη αγορά</b> · ${b.load}/${b.n} πληρούν «φόρτωμα long», ${b.liq}/${b.n} «ρευστοποίηση», ${b.abs} απορρόφηση · OI αγοράς 30′ ${p2(b.moi)}, αγορ./πωλ. ${fin(b.tk)?b.tk.toFixed(2).replace(".",","):"—"}.`);
    tags.push("b"+(b.load>=b.n/2?"L":b.liq>=b.n/2?"S":b.load>=b.n/4?"l":b.liq>=b.n/4?"s":"0"))}
  // επίπεδα (έως 3): πιο κοντινό πάνω, πιο κοντινό κάτω, άκρη/βάση μηχανής ή άνοιγμα
  const cand=[];const lv=x.lv||{};if(fin(lv.hi60))cand.push([lv.hi60,"υψηλό 60′"]);if(fin(lv.lo60))cand.push([lv.lo60,"χαμηλό 60′"]);if(fin(lv.open))cand.push([lv.open,"τιμή ανοίγματος"]);
  const mv=(x.eng||[]).find(e=>e.ph==="move"),wt=(x.eng||[]).find(e=>e.ph!=="move"&&!e.early);
  if(mv&&fin(mv.edge))cand.push([mv.edge,"άκρη κίνησης"]);else if(wt&&fin(wt.base))cand.push([wt.base,"βάση φορτώματος"]);
  const up=cand.filter(c=>c[0]>x.px).sort((a,b)=>a[0]-b[0])[0],dn=cand.filter(c=>c[0]<x.px).sort((a,b)=>b[0]-a[0])[0];const lev=[];
  if(up)lev.push({p:up[0],lab:up[1],side:"πάνω"});if(dn)lev.push({p:dn[0],lab:dn[1],side:"κάτω"});
  const third=cand.find(c=>(mv||wt)&&(c[1]==="άκρη κίνησης"||c[1]==="βάση φορτώματος")&&!lev.some(l=>l.p===c[0]))||cand.find(c=>c[1]==="τιμή ανοίγματος"&&!lev.some(l=>l.p===c[0]));
  if(third&&lev.length<3)lev.push({p:third[0],lab:third[1],side:third[0]>x.px?"πάνω":"κάτω"});
  const eng=(x.eng||[]).map(e=>(e.ph==="move"?"κίνηση ":e.early?"πρώιμο ":"παρακολούθηση ")+(e.dir>0?"L":"S")).join("+")||"ήσυχα";tags.push("e:"+eng);
  return {ver:VER,t:x.t,px:x.px,lines:L.slice(0,4),levels:lev.slice(0,3),eng,news:(x.news||[]).map(n=>`${tA(n.t)} ${n.title}`),partial:x.part||[],tags:tags.join(" ")}}
function text(s){return s?s.lines.map(l=>l.replace(/<[^>]+>/g,"")):[]}
const TGSUM={VER,anchor,fromRaw,build,text,TH,px,tA};
if(typeof module!=="undefined")module.exports={TGSUM};else root.TGSUM=TGSUM;
})(typeof window!=="undefined"?window:this);
