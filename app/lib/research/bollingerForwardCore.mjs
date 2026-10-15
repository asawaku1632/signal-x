import {createHash} from 'node:crypto';
import {inspectAsOf,gradeForward} from './bollingerBreakoutShadow.mjs';
import {inspectAsOfFactors} from './bollingerAsOfFactorCore.mjs';
import {validateCompletedArchive} from './bollingerBreakoutQuality.mjs';
import {BB_BREAKOUT_BATCHES} from './bollingerBreakoutBatches.ts';
import {BB_EXPANSION_BATCHES} from './bollingerExpansionUniverse.ts';

export const FORWARD_VERSION='BB_FORWARD_20261016_V1';
export const FORWARD_START='2026-10-16';
export const DAILY_CODES=20;
export const MAX_PENDING_CODES=10;
export const MAX_VENDOR_REQUESTS=DAILY_CODES+MAX_PENDING_CODES;
export const ALL_HORIZONS=[1,3,5];
export const FROZEN_100=Object.freeze([
 ...BB_BREAKOUT_BATCHES.flat(),...BB_EXPANSION_BATCHES.flat()
]);
const number6=n=>Number(n.toFixed(6));
const dateJst=t=>new Date(Number(t)*1000).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
export function validateFrozenUniverse(){
 return FROZEN_100.length===100&&new Set(FROZEN_100).size===100&&
  FROZEN_100.every(x=>/^\d{4}$/.test(x));
}
export function batchForMarketOrdinal(ordinal){
 if(!validateFrozenUniverse())throw Error('INVALID_FIXED_UNIVERSE');
 if(!Number.isSafeInteger(ordinal)||ordinal<0)throw Error('INVALID_TRADE_ORDINAL');
 const batchId=ordinal%5;
 return {batchId,codes:FROZEN_100.slice(batchId*DAILY_CODES,(batchId+1)*DAILY_CODES)};
}
export function snapshotHash(candles,t,calendar){
 if(!Array.isArray(candles)||!Number.isInteger(t)||t<80||t>=candles.length)
  throw Error('BAD_FROZEN_SNAPSHOT_WINDOW');
 if(typeof calendar!=='string'||!calendar)throw Error('MISSING_CALENDAR_VERSION');
 return createHash('sha256').update(JSON.stringify({
  policy:FORWARD_VERSION,calendar,history:candles.slice(t-80,t+1)
 })).digest('hex');
}
/** Run only against a genuinely newly completed signal day.
 * No source observation is eligible after its calendar day has passed.
 * Does not fetch or store; caller controls market-time and batch uniqueness.
 */
export function identifyTodayProspectiveSignal(input,target,calendar){
 const quality=validateCompletedArchive(input);
 if(!quality.ok)throw Error('PROVIDER_QUALITY:'+quality.reason);
 if(target<FORWARD_START||input.asOfCompletedJstDate!==target||
    input.expectedTradingDates.at(-1)!==target)throw Error('NOT_A_FRESH_SIGNAL_DAY');
 const t=input.candles.length-1;
 if(t<80)throw Error('INSUFFICIENT_HISTORY');
 const b=input.candles[t];
 // Already known splits across 80 prior bars through today's close invalidate signal.
 if(input.splitEvents.some(ts=>ts>=input.candles[t-80].time&&ts<=b.time))return null;
 const signal=inspectAsOf(input.candles,t);
 if(!signal.eligible)throw Error('BB_UNAVAILABLE');
 if(!signal.breakout)return null;
 const factors=inspectAsOfFactors(input.candles,t);
 const volumeRatio=typeof signal.volumeRatio==='number'&&
   Number.isFinite(signal.volumeRatio)&&signal.volumeRatio>=0?
   number6(signal.volumeRatio):null;
 if(volumeRatio!==null&&volumeRatio>100000)throw Error('VOLUME_LIMIT');
 return {
  version:FORWARD_VERSION,code:input.code,
  signal_time:b.time,signal_date:target,group_key:signal.group,
  signal_close:number6(b.close),source_hash:snapshotHash(input.candles,t,calendar),
  calendar_version:calendar,
  rsi_group:factors.rsiGroup,trend_group:factors.trendGroup,
  breakout_group:factors.breakoutGroup,
  rsi14:factors.rsi14,trend10_percent:factors.trend10Percent,
  breakout_strength_percent:factors.breakoutStrengthPercent,
  volume_ratio:volumeRatio,
  volume_bucket:volumeRatio===null?'UNKNOWN':
    volumeRatio>=1.3?'HIGH_1_3X':'BELOW_1_3X'
 };
}
/** Each existing frozen signal is graded only when subsequent sessions exist.
 * Source fingerprint must stay identical; no retrospective feature rebuilding.
 * Split-affected horizons receive EXCLUDED_SPLIT, never a synthetic P/L.
 */
export function gradeFrozenProspectiveSignal(signal,input,target){
 const quality=validateCompletedArchive(input);
 if(!quality.ok)throw Error('SOURCE_QUALITY_REVISED');
 if(input.expectedTradingDates.at(-1)!==target)throw Error('STALE_RESULT_SOURCE');
 const t=input.candles.findIndex(c=>c.time===Number(signal.signal_time));
 if(t<80)throw Error('FROZEN_SIGNAL_OUTSIDE_SOURCE');
 if(dateJst(input.candles[t].time)!==signal.signal_date)throw Error('FROZEN_DATE_REVISED');
 if(snapshotHash(input.candles,t,signal.calendar_version)!==signal.source_hash)
  throw Error('FROZEN_SOURCE_REVISED');
 const study=gradeForward(input.candles,t,signal.code);
 if(!study.signal.breakout||study.signal.group!==signal.group_key)
  throw Error('FROZEN_DETECTOR_CHANGED');
 const outcomes=[];
 for(const horizon of ALL_HORIZONS){
  if(t+horizon>=input.candles.length)continue;
  const future=input.candles.slice(t+1,t+horizon+1);
  const split=input.splitEvents.some(ts=>ts>=future[0].time&&ts<=future.at(-1).time);
  if(split){
   outcomes.push({version:FORWARD_VERSION,code:signal.code,
    signal_time:Number(signal.signal_time),horizon,status:'EXCLUDED_SPLIT',
    entry_time:null,exit_time:null,entry_price:null,exit_price:null,
    return_percent:null,max_adverse_percent:null});
   continue;
  }
  const h=study.horizons[horizon];
  if(h?.status!=='COMPLETE')throw Error('MATURE_OUTCOME_NOT_COMPLETE');
  outcomes.push({version:FORWARD_VERSION,code:signal.code,
   signal_time:Number(signal.signal_time),horizon,status:'COMPLETE',
   entry_time:h.entryTime,exit_time:h.exitTime,
   entry_price:number6(h.entryPrice),exit_price:number6(h.exitPrice),
   return_percent:number6(h.returnPercent),
   max_adverse_percent:number6(h.maxAdversePercent)});
 }
 return outcomes;
}
