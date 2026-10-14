import {createHash} from 'node:crypto';
import {VERSION} from './bollingerBreakoutShadow.mjs';
import {studyCompletedArchiveStock} from './bollingerBreakoutQuality.mjs';

export const VOLUME_FACTOR_VERSION='BB_VOLUME_SHADOW_V1';
export const VOLUME_LIMIT=1.3;
function recordKey(code,time){return code+':'+String(time);}
function finitePositive(n){return typeof n==='number'&&Number.isFinite(n)&&n>0;}
/**
 * Reconstruct the exact original saved 1-day outcome source hash before
 * accepting an as-of volume ratio. Source revisions are a hard failure.
 * Never use forward candle volume, AI data, or revised signal classifications.
 */
export function matchArchivedVolumeFactors(inputs,stored,calendarVersion){
  if(!Array.isArray(inputs)||!Array.isArray(stored)||inputs.length<1||inputs.length>5)
    throw Error('INVALID_COHORT');
  if(typeof calendarVersion!=='string'||!calendarVersion)throw Error('CALENDAR_UNAVAILABLE');
  const codes=new Set(inputs.map(x=>x.code));
  if(codes.size!==inputs.length||codes.has(undefined))throw Error('DUPLICATE_STOCK');
  const archive=new Map();
  for(const source of inputs){
    const checked=studyCompletedArchiveStock(source);
    if(!checked.quality.ok)throw Error('QUALITY_REJECTED:'+source.code);
    const map=new Map();
    for(const r of checked.records){
      if(r.horizons[1]?.status==='COMPLETE')
        map.set(recordKey(source.code,r.signal.signalTime),r);
    }
    archive.set(source.code,{source,bySignal:map});
  }
  const result=[],seen=new Set();
  for(const row of stored){
    if(!codes.has(row.code)||row.detector_version!==VERSION||Number(row.horizon)!==1)
      throw Error('UNEXPECTED_ARCHIVED_OUTCOME');
    const key=recordKey(row.code,Number(row.signal_time));
    if(seen.has(key))throw Error('DUPLICATE_ARCHIVED_SIGNAL');
    seen.add(key);
    const hit=archive.get(row.code);
    const r=hit?.bySignal.get(key);
    if(!r)throw Error('ARCHIVED_SIGNAL_NOT_REPRODUCED:'+row.code);
    const source=hit.source;
    const t=r.signal.signalIndex;
    if(!Number.isInteger(t)||t<80||t+1>=source.candles.length)
      throw Error('INVALID_SIGNAL_WINDOW');
    const fingerprint=createHash('sha256').update(JSON.stringify({
      version:VERSION,calendar:calendarVersion,
      code:row.code,history:source.candles.slice(t-80,t+1),
      future:source.candles.slice(t+1,t+2)
    })).digest('hex');
    if(fingerprint!==row.source_hash)
      throw Error('ARCHIVED_SOURCE_REVISED:'+row.code);
    if(row.group_key!==r.signal.group||
       !finitePositive(Number(row.signal_close))||
       Math.abs(Number(row.signal_close)-r.signal.signalClose)>0.000001)
      throw Error('ARCHIVED_CLASSIFICATION_REVISED:'+row.code);
    const raw=r.signal.volumeRatio;
    const ratio=typeof raw==='number'&&Number.isFinite(raw)&&raw>=0
      ?Number(raw.toFixed(6)):null;
    if(ratio!==null&&ratio>100000)throw Error('VOLUME_RATIO_LIMIT');
    result.push({code:row.code,signal_time:Number(row.signal_time),
      original_source_hash:fingerprint,volume_ratio:ratio,
      volume_bucket:ratio===null?'UNKNOWN':ratio>=VOLUME_LIMIT?'HIGH_1_3X':'BELOW_1_3X'});
  }
  if(result.length===0)throw Error('NO_ARCHIVED_EVENTS');
  return result.sort((a,b)=>a.code.localeCompare(b.code)||a.signal_time-b.signal_time);
}
