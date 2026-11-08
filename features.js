// TG Πρόβλεψη — feature engine. Must match scripts/tb.py exactly.
(function(root){
const F=Math.fround, NaNv=NaN;
function shift(a,k){const o=new Array(a.length).fill(NaN);for(let i=k;i<a.length;i++)o[i]=a[i-k];return o}
function roll(a,w,fn){const o=new Array(a.length).fill(NaN);for(let i=w-1;i<a.length;i++){let bad=false;const s=[];for(let j=i-w+1;j<=i;j++){const v=a[j];if(Number.isNaN(v)){bad=true;break}s.push(v)}if(!bad)o[i]=fn(s)}return o}
const mean=s=>{let t=0;for(const v of s)t+=v;return t/s.length};
const sum=s=>{let t=0;for(const v of s)t+=v;return t};
const std=s=>{const m=mean(s);let t=0;for(const v of s)t+=(v-m)*(v-m);return Math.sqrt(t/(s.length-1))};
const mn=s=>Math.min(...s), mx=s=>Math.max(...s);
function ewm(a,span){const al=2/(span+1),q=1-al;const o=[];let num=0,den=0;for(let i=0;i<a.length;i++){num=a[i]+q*num;den=1+q*den;o.push(num/den)}return o}
function asofBack(times,vals,t,tol){ // last index with times<=t (and t-times<=tol)
  let lo=0,hi=times.length-1,r=-1;while(lo<=hi){const m=(lo+hi)>>1;if(times[m]<=t){r=m;lo=m+1}else hi=m-1}
  if(r<0)return NaN; if(tol!==undefined&&t-times[r]>tol)return NaN; return vals[r]}
// bars: {t,o,h,l,c,v,ct,tbv}; fund: {times,vals}|null ; oi: {ts,oiv,ttp,tta,gl,tkts,tkv}|null
function symFeatures(b,fund,oi,tf){
  const n=b.t.length,c=b.c,h=b.h,l=b.l,o=b.o,v=b.v;const X={};
  const lr=c.map((x,i)=>i?Math.log(x)-Math.log(c[i-1]):NaN);
  const vol={};for(const k of[16,64])vol[k]=roll(lr,k,std);
  const ks=[1,2,4,8,16,32,64];
  for(const k of ks){const s=shift(c,k);X['r'+k]=c.map((x,i)=>Math.log(x/s[i])/vol[64][i])}
  X.vol16=vol[16];X.vol64=vol[64];X.volr=vol[16].map((x,i)=>x/vol[64][i]);
  const cp=shift(c,1);const tr=c.map((_,i)=>{const a=h[i]-l[i],b1=Math.abs(h[i]-cp[i]),b2=Math.abs(l[i]-cp[i]);if(Number.isNaN(b1)||Number.isNaN(b2))return NaN;return Math.max(a,b1,b2)});
  const atr=roll(tr,14,mean);
  X.rng=c.map((_,i)=>(h[i]-l[i])/atr[i]);X.body=c.map((_,i)=>(c[i]-o[i])/atr[i]);
  X.wick_up=c.map((_,i)=>(h[i]-Math.max(o[i],c[i]))/atr[i]);X.wick_dn=c.map((_,i)=>(Math.min(o[i],c[i])-l[i])/atr[i]);
  for(const k of[24,96,384]){const lo=roll(l,k,mn),hi=roll(h,k,mx);X['pos'+k]=c.map((x,i)=>(x-lo[i])/(hi[i]-lo[i]))}
  for(const k of[20,50,200]){const e=ewm(c,k);X['ema'+k]=c.map((x,i)=>(x/e[i]-1)/vol[64][i])}
  const vm=roll(v,96,mean),vs=roll(v,96,std);X.vz=v.map((x,i)=>(x-vm[i])/vs[i]);
  const tb=v.map((x,i)=>b.tbv[i]/x);X.tb=tb;X.tb8=roll(tb,8,mean);
  const dv=v.map((x,i)=>2*b.tbv[i]-x);
  for(const k of[16,64]){const a=roll(dv,k,sum),d=roll(v,k,sum);X['cvd'+k]=a.map((x,i)=>x/d[i])}
  X.hr=b.t.map(t=>new Date(t).getUTCHours());X.dow=b.t.map(t=>(new Date(t).getUTCDay()+6)%7);
  X.fund=b.ct.map(ct=>fund?asofBack(fund.times,fund.vals,ct):NaN);
  X.atrp=atr.map((x,i)=>x/c[i]);
  if(oi){ const W={"15m":3,"1h":12,"4h":48,"1d":288}[tf], BAR={"15m":9e5,"1h":36e5,"4h":144e5,"1d":864e5}[tf];
    const tk=oi.tkv.map(x=>Math.log(Math.max(x,1e-6)));const tkb=roll(tk,1,mean).map((_,i)=>{let s=0,cnt=0;for(let j=Math.max(0,i-W+1);j<=i;j++){s+=tk[j];cnt++}return s/cnt});
    const g=(arr,ts)=>b.ct.map(ct=>asofBack(ts,arr,ct+1,BAR));
    const lo=g(oi.oiv.map(Math.log),oi.ts);
    for(const k of[1,4,16,64]){const s=shift(lo,k);X['oi_c'+k]=lo.map((x,i)=>x-s[i])}
    const om=roll(lo,96,mean),os=roll(lo,96,std);X.oi_z96=lo.map((x,i)=>(x-om[i])/os[i]);
    for(const[nm,arr] of[["ttp",oi.ttp],["tta",oi.tta],["gl",oi.gl]]){const s=g(arr.map(Math.log),oi.ts);X[nm]=s;const s4=shift(s,4);X[nm+'_c4']=s.map((x,i)=>x-s4[i]);const m=roll(s,96,mean),sd=roll(s,96,std);X[nm+'_z96']=s.map((x,i)=>(x-m[i])/sd[i])}
    X.tt_vs_gl=X.tta.map((x,i)=>x-X.gl[i]);
    // taker 5m: live ts == archive ts (no shift); OI/LS 4h: live ts == archive ts+5m
    X.taker_bar=b.ct.map(ct=>asofBack(oi.tkts,tkb,ct,BAR));X.taker8=roll(X.taker_bar,8,mean);
  }
  const s4=shift(c,4),s16=shift(c,16);X.r4raw=c.map((x,i)=>Math.log(x/s4[i]));X.r16raw=c.map((x,i)=>Math.log(x/s16[i]));
  for(const k in X) if(k!=='hr'&&k!=='dow') X[k]=X[k].map(F);
  X._atr=atr;return X;
}
// all: {SYM:{bars,X}} aligned by open time. Returns feature rows for index of each sym's bar at time t.
function crossAt(all,syms,t,useOI){
  const rows={};const get=(s)=>{const A=all[s];if(!A)return -1;return A.idx.get(t)??-1};
  const r4=[],r16=[];for(const s of syms){const i=get(s);if(i<0)continue;r4.push(all[s].X.r4raw[i]);r16.push(all[s].X.r16raw[i])}
  const nn=a=>a.filter(x=>!Number.isNaN(x));
  const b4=mean(nn(r4)),b16=mean(nn(r16));const up=r4.filter(x=>x>0).length/r4.length;
  const v16=nn(r16).slice().sort((a,b)=>a-b);
  const rank=x=>{if(Number.isNaN(x))return NaN;let lo=0,eq=0;for(const y of v16){if(y<x)lo++;else if(y===x)eq++}return (lo+(eq+1)/2)/v16.length};
  const bi=get('BTCUSDT');const B=all.BTCUSDT;
  let moi=NaN;if(useOI){const a=[];for(const s of syms){const i=get(s);if(i>=0&&all[s].X.oi_c4){const x=all[s].X.oi_c4[i];if(!Number.isNaN(x))a.push(x)}}moi=a.length?mean(a):NaN}
  for(const s of syms){const i=get(s);if(i<0)continue;const X=all[s].X;
    rows[s]={btc_r1:bi<0?NaN:B.X.r1[bi],btc_r4:bi<0?NaN:B.X.r4[bi],btc_r16:bi<0?NaN:B.X.r16[bi],btc_cvd16:bi<0?NaN:B.X.cvd16[bi],btc_vol16:bi<0?NaN:B.X.vol16[bi],
      breadth4:b4,breadth16:b16,up_share:up,rs16:X.r16raw[i]-b16,rs_rank:rank(X.r16raw[i]),sym_id:syms.indexOf(s),mkt_oi_c4:moi};}
  return rows;
}
function vector(M,X,i,cross){return M.features.map(f=>{if(f in cross)return cross[f];const a=X[f];return a?a[i]:NaN})}

// Macro (FRED) — must match scripts/macfeat.py (_daily). series: {ID:[[ "YYYY-MM-DD", value ],...]}
function macroFrame(series){
  const ids=["DTWEXBGS","DGS10","DGS2","DFII10","T10Y2Y","VIXCLS","BAMLH0A0HYM2","DCOILBRENTEU","SP500","NASDAQCOM"]; // HY only defines the date grid (as in training)
  const maps={};const dates=new Set();
  for(const id of ids){maps[id]=new Map();for(const [d,v] of (series[id]||[])){const x=parseFloat(v);if(!Number.isFinite(x))continue;maps[id].set(d,x);dates.add(d)}}
  const D=[...dates].sort();const col={};for(const id of ids){let last=NaN;col[id]=D.map(d=>{if(maps[id].has(d))last=maps[id].get(d);return last})}
  const n=D.length,lg=a=>a.map(Math.log),diff=(a,k)=>a.map((x,i)=>i>=k?x-a[i-k]:NaN);
  const F={m_dxy_c5:diff(lg(col.DTWEXBGS),5),m_dxy_c20:diff(lg(col.DTWEXBGS),20),m_y10_c5:diff(col.DGS10,5),m_ry10:col.DFII10,m_ry10_c5:diff(col.DFII10,5),m_curve:col.T10Y2Y,
    m_vix:col.VIXCLS,m_vix_c5:diff(lg(col.VIXCLS),5),m_brent_c5:diff(lg(col.DCOILBRENTEU),5),m_spx_c5:diff(lg(col.SP500),5),m_ndx_c5:diff(lg(col.NASDAQCOM),5)};
  const avail=D.map(d=>Date.parse(d+"T00:00:00Z")+86400000+4*3600000);
  return{avail,F,dates:D};
}
function addMacro(X,b,MF){if(!MF)return;for(const k in MF.F){const v=MF.F[k];X[k]=b.ct.map(ct=>Math.fround(asofBack(MF.avail,v,ct)))}}
root.TGF={symFeatures,crossAt,vector,macroFrame,addMacro};
})(typeof module!=="undefined"?module.exports:window);
