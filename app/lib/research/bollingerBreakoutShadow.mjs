/** SHADOW ONLY: completed daily bars, no database/network/cron/AI effects. */
export const VERSION = 'BB_BREAKOUT_SHADOW_V1';
export const HORIZONS = [1,3,5];
const N=20, LOOKBACK=60, MIN_SAMPLE=30;
const valid=b=>b && [b.time,b.open,b.high,b.low,b.close].every(Number.isFinite)
  && b.open>0 && b.low>0 && b.close>0 && b.high>=Math.max(b.open,b.close)
  && b.low<=Math.min(b.open,b.close);
function band(bars,i){
  if(i<N-1)return null;
  const p=bars.slice(i-N+1,i+1).map(b=>b.close);
  const mean=p.reduce((a,b)=>a+b,0)/N;
  const sd=Math.sqrt(p.reduce((s,x)=>s+(x-mean)**2,0)/N);
  return mean>0 && sd>0 && Number.isFinite(sd)
    ? {width:4*sd/mean,upper1:mean+sd,upper2:mean+2*sd}:null;
}
/** Signal at t. Reference widths t-61..t-2, squeeze at t-1, breakout at t. */
export function inspectAsOf(bars,t=bars.length-1){
  if(!Array.isArray(bars)||!Number.isInteger(t)||t<0||t>=bars.length)
    return {eligible:false,reason:'INVALID_INDEX'};
  if(t<N+LOOKBACK)return {eligible:false,reason:'INSUFFICIENT_HISTORY'};
  for(let i=0;i<=t;i++)if(!valid(bars[i])||(i>0&&bars[i].time<=bars[i-1].time))
    return {eligible:false,reason:'INVALID_HISTORY'};
  const prev=band(bars,t-1),older=band(bars,t-2),curr=band(bars,t);
  const widths=[];
  for(let i=t-LOOKBACK-1;i<=t-2;i++){
    const b=band(bars,i);if(!b)return {eligible:false,reason:'INVALID_BANDS'};
    widths.push(b.width);
  }
  if(!prev||!older||!curr||widths.length!==LOOKBACK)
    return {eligible:false,reason:'INVALID_BANDS'};
  widths.sort((a,b)=>a-b);
  const threshold=widths[Math.floor(widths.length*.25)];
  const squeezed=prev.width<=threshold;
  const breakout=bars[t].close>prev.upper2 && bars[t-1].close<=older.upper2;
  const pastVolumes=bars.slice(t-N,t).map(b=>b.volume);
  const avgVol=pastVolumes.every(v=>Number.isFinite(v)&&v>0)
    ?pastVolumes.reduce((s,v)=>s+v,0)/N:null;
  const volumeRatio=avgVol!==null&&Number.isFinite(bars[t].volume)&&bars[t].volume>=0
    ?bars[t].volume/avgVol:null;
  const group=breakout?(squeezed?'SQUEEZE_UP_BREAKOUT':'OTHER_UP_BREAKOUT')
    :(squeezed?'SQUEEZE_NO_BREAKOUT':'OTHER');
  return {eligible:true,version:VERSION,group,squeezed,breakout,
    signalIndex:t,signalTime:bars[t].time,signalClose:bars[t].close,
    widthAtPriorClose:prev.width,reference25th:threshold,
    volumeRatio,volumeConfirmed:volumeRatio===null?null:volumeRatio>=1.3};
}
/** Forward-only grading; entry is NEXT session's open, never signal close. */
export function gradeForward(bars,t,code){
  const signal=inspectAsOf(bars,t);
  if(!signal.eligible||!signal.breakout)return {code,signal,horizons:{},nextDayReturnInside:null};
  const horizons={};
  for(const h of HORIZONS){
    const future=bars.slice(t+1,t+h+1);
    if(future.length<h){horizons[h]={status:'PENDING'};continue;}
    let last=bars[t].time;
    if(!future.every(b=>{const good=valid(b)&&b.time>last;last=b.time;return good;})){
      horizons[h]={status:'INVALID_FUTURE'};continue;
    }
    const entry=future[0].open;
    horizons[h]={status:'COMPLETE',entryPrice:entry,exitPrice:future.at(-1).close,
      returnPercent:100*(future.at(-1).close/entry-1),
      maxAdversePercent:100*(Math.min(...future.map(x=>x.low))/entry-1),
      maxFavorablePercent:100*(Math.max(...future.map(x=>x.high))/entry-1),
      entryTime:future[0].time,exitTime:future.at(-1).time};
  }
  const nextBand=horizons[1]?.status==='COMPLETE'?band(bars,t+1):null;
  // Outcome-only proxy of a return inside +2σ, never a signal-time feature.
  const nextDayReturnInside=nextBand?bars[t+1].close<nextBand.upper2:null;
  return {code,signal,horizons,nextDayReturnInside};
}
export function summarize(records){
  if(!Array.isArray(records))throw new TypeError('INVALID_RECORDS');
  const seen=new Set();
  for(const r of records){
    if(!r?.signal?.eligible||!r.signal.breakout)continue;
    if(typeof r.code!=='string'||!/^[0-9]{4}$/.test(r.code))
      throw new TypeError('MISSING_STOCK_CODE');
    const key=r.code+':'+r.signal.signalTime;
    if(seen.has(key))throw new TypeError('DUPLICATE_SIGNAL');
    seen.add(key);
  }
  return Object.fromEntries(['SQUEEZE_UP_BREAKOUT','OTHER_UP_BREAKOUT'].map(group=>{
    const selected=records.filter(r=>r?.signal?.group===group&&r.signal.version===VERSION);
    const horizons=Object.fromEntries(HORIZONS.map(h=>{
      const good=selected.map(r=>r.horizons?.[h]).filter(x=>x?.status==='COMPLETE');
      const n=good.length,ready=n>=MIN_SAMPLE;
      return [h,{sampleCount:n,missing:selected.length-n,
        status:!ready?'INSUFFICIENT_SAMPLE':n<selected.length?'INCOMPLETE':'COMPLETE',
        positiveRate:ready?good.filter(x=>x.returnPercent>0).length/n:null,
        meanReturnPercent:ready?good.reduce((s,x)=>s+x.returnPercent,0)/n:null,
        meanMaxAdversePercent:ready?good.reduce((s,x)=>s+x.maxAdversePercent,0)/n:null}];
    }));
    return [group,{eventCount:selected.length,horizons,
      nextDayKnownCount:selected.filter(x=>typeof x.nextDayReturnInside==='boolean').length,
      nextDayReturnedInsideCount:selected.filter(x=>x.nextDayReturnInside===true).length}];
  }));
}
