import {createHash} from 'node:crypto';
import {studyCompletedArchiveStock} from './bollingerBreakoutQuality.mjs';
import {VERSION as BREAKOUT_VERSION} from './bollingerBreakoutShadow.mjs';

export const FACTOR_VERSION='BB_ASOF_RSI_TREND_STRENGTH_V1';
const nRound=x=>Number(x.toFixed(6));
function rsi14(closes,t){
 // Simple rolling 14-session RSI (not Wilder smoothing). Only signal day and prior 14 closes.
 let gains=0,losses=0;
 for(let j=t-13;j<=t;j++){
  const diff=closes[j]-closes[j-1];
  if(diff>0)gains+=diff;
  else losses-=diff;
 }
 if(gains+losses===0)return 50;
 if(losses===0)return 100;
 return 100*gains/(gains+losses);
}
export function inspectAsOfFactors(candles,t){
 if(!Array.isArray(candles)||!Number.isInteger(t)||t<80||t>=candles.length)
  throw Error('ASOF_RANGE_INVALID');
 // Never read any bars with index > t.
 const closes=candles.slice(0,t+1).map(b=>b.close);
 if(closes.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<=0))
  throw Error('ASOF_PRICE_INVALID');
 const signal=closes[t],prior=closes.slice(t-20,t);
 const mean=prior.reduce((a,b)=>a+b,0)/20;
 const sd=Math.sqrt(prior.reduce((a,b)=>a+(b-mean)**2,0)/20);
 if(!(mean>0&&sd>0))throw Error('ASOF_BAND_INVALID');
 const priorUpper=mean+2*sd;
 const distance=100*(signal/priorUpper-1);
 if(!(distance>0))throw Error('NOT_AN_UPPER_BREAKOUT');
 const trend10=100*(signal/closes[t-10]-1);
 const rsi=nRound(rsi14(closes,t));
 const trend=nRound(trend10),strength=nRound(distance);
 return {rsi14:rsi,trend10Percent:trend,breakoutStrengthPercent:strength,
  rsiGroup:rsi>=70?'RSI_70_PLUS':rsi>=50?'RSI_50_TO_70':'RSI_BELOW_50',
  trendGroup:trend>=5?'TREND_UP_5_PLUS':trend>=0?'TREND_FLAT_TO_5':'TREND_NEGATIVE',
  breakoutGroup:strength>=2?'BREAKOUT_2_PLUS':'BREAKOUT_BELOW_2'};
}
const key=(code,time)=>code+':'+String(time);
/** Verify all stored original NEXT-DAY source fingerprints against entire
 * immutable 80-bar lookback, signal-day and +1 day, BEFORE calculating factors.
 * This is retrospective source verification; no future-data factor leakage.
 */
export function matchSavedAsOfFactors(inputs,rows,calendarVersion){
 if(!Array.isArray(inputs)||inputs.length!==5||!Array.isArray(rows))
  throw Error('BAD_COHORT');
 if(typeof calendarVersion!=='string'||!calendarVersion)throw Error('CALENDAR_INVALID');
 const map=new Map();
 for(const source of inputs){
  if(map.has(source.code))throw Error('DUPLICATE_CODE');
  const report=studyCompletedArchiveStock(source);
  if(!report.quality.ok)throw Error('COHORT_QUALITY_REJECTED');
  map.set(source.code,{source,records:new Map(report.records
   .filter(r=>r.horizons[1]?.status==='COMPLETE')
   .map(r=>[key(source.code,r.signal.signalTime),r]))});
 }
 const found=[],seen=new Set();
 for(const row of rows){
  if(row.detector_version!==BREAKOUT_VERSION||Number(row.horizon)!==1)
   throw Error('ARCHIVE_VERSION_MISMATCH');
  const box=map.get(row.code);
  if(!box)throw Error('UNKNOWN_ARCHIVED_CODE');
  const k=key(row.code,Number(row.signal_time));
  if(seen.has(k))throw Error('ARCHIVE_DUPLICATED');
  seen.add(k);
  const rec=box.records.get(k);
  if(!rec)throw Error('ARCHIVE_SIGNAL_NOT_REPRODUCIBLE:'+row.code);
  const t=rec.signal.signalIndex;
  const hash=createHash('sha256').update(JSON.stringify({
   version:BREAKOUT_VERSION,calendar:calendarVersion,code:row.code,
   history:box.source.candles.slice(t-80,t+1),
   future:box.source.candles.slice(t+1,t+2)
  })).digest('hex');
  if(hash!==row.source_hash)throw Error('SOURCE_HASH_REVISED:'+row.code);
  if(row.group_key!==rec.signal.group||
     Math.abs(Number(row.signal_close)-rec.signal.signalClose)>0.000001)
   throw Error('ARCHIVED_SIGNAL_CHANGED:'+row.code);
  const factors=inspectAsOfFactors(box.source.candles,t);
  found.push({code:row.code,signal_time:Number(row.signal_time),
   detector_version:BREAKOUT_VERSION,original_source_hash:hash,
   factor_version:FACTOR_VERSION,...factors});
 }
 return found.sort((a,b)=>a.code.localeCompare(b.code)||a.signal_time-b.signal_time);
}
