/** Shadow-only integrity gates. No live trading or notifications. */
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const valid=b=>b&&Number.isSafeInteger(b.time)&&b.time>0&&[b.open,b.high,b.low,b.close].every(positive)&&typeof b.volume==='number'&&Number.isFinite(b.volume)&&b.volume>=0&&b.high>=Math.max(b.open,b.close,b.low)&&b.low<=Math.min(b.open,b.close,b.high);
export function auditMa75PriceHistory(bars,start,end){
 if(!Array.isArray(bars)||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>=bars.length||start>end)return 'INVALID_WINDOW';
 for(let i=start;i<=end;i++){
  if(!valid(bars[i]))return 'INVALID_OHLCV_OR_TIME';
  if(i>0){if(!valid(bars[i-1]))return 'INVALID_OHLCV_OR_TIME';if(bars[i].time<=bars[i-1].time)return 'DUPLICATE_OR_UNSORTED';if(Math.abs(bars[i].close/bars[i-1].close-1)>0.45||Math.abs(bars[i].open/bars[i-1].close-1)>0.45)return 'QUARANTINED_PRICE_GAP';}
 }
 return 'PASS';
}
export function auditMa75SourceAsOf({source,capturedAt,signalCloseAt,entryOpenAt}){
 if(!source||!Number.isSafeInteger(capturedAt)||!Number.isSafeInteger(signalCloseAt)||!Number.isSafeInteger(entryOpenAt)||signalCloseAt<=0||capturedAt<=0||entryOpenAt<=signalCloseAt)return 'PROVENANCE_UNVERIFIED';
 if(capturedAt<signalCloseAt)return 'CAPTURE_BEFORE_SIGNAL_CLOSE';
 if(capturedAt>=entryOpenAt)return 'LATE_CAPTURE_OFFLINE_ONLY';
 return 'TIMING_PLAUSIBLE_NOT_AUTHENTICATED';
}

/** Research-only MA75 verification. Uses closes through signalIndex, never later bars. */
export function auditMa75AsOfInputs({bars,signalIndex,ma75Today,ma75Prior,tolerance=1e-8}={}){
 if(!Array.isArray(bars)||!Number.isInteger(signalIndex)||signalIndex<75||signalIndex>=bars.length||
   !positive(ma75Today)||!positive(ma75Prior)||!Number.isFinite(tolerance)||tolerance<0)
  return {status:'INVALID_MA75_INPUT',verified:false};
 const safety=auditMa75PriceHistory(bars,signalIndex-75,signalIndex);
 if(safety!=='PASS')return {status:safety,verified:false};
 const mean=end=>{let sum=0;for(let i=end-74;i<=end;i++)sum+=bars[i].close;return sum/75;};
 const derivedToday=mean(signalIndex),derivedPrior=mean(signalIndex-1);
 const closeEnough=(given,actual)=>Math.abs(given-actual)<=tolerance*Math.max(1,Math.abs(actual));
 return {status:closeEnough(ma75Today,derivedToday)&&closeEnough(ma75Prior,derivedPrior)?
  'MA75_ASOF_MATCH':'MA75_ASOF_MISMATCH',verified:closeEnough(ma75Today,derivedToday)&&closeEnough(ma75Prior,derivedPrior),
  derivedToday,derivedPrior};
}
