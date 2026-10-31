/**
 * SHADOW ONLY: pre-frozen whole-universe audit, including NO_CROSS and missing observations.
 * Price, provenance and exchange-calendar values are user-supplied assertions; no
 * independent certification or forward profitability claim is made here.
 */
import { verifyMa75ForwardManifest } from './ma75ForwardProtocol.mjs';
export const MA75_UNIVERSE_COVERAGE_VERSION='ma75_universe_coverage_v1';
const day=d=>typeof d==='string'&&/^20\d\d-\d\d-\d\d$/.test(d)&&
 Number.isFinite(Date.parse(d+'T00:00:00Z'))&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const timestamp=x=>typeof x==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const key=(code,date)=>String(code)+':'+String(date);
const percent=(n,d)=>d?Number((n*100/d).toFixed(2)):null;
const signalOf=x=>number(x?.close)&&number(x?.priorClose)&&
 number(x?.sma75)&&number(x?.priorSma75)&&
 x.close>x.sma75&&x.priorClose<=x.priorSma75;

/**
 * Require one row for each code/trading-date cell, not merely the signals that
 * were later selected. Only a verified provider ledger could authenticate these
 * claimed captures; this is a completeness/consistency check, not that proof.
 */
export function auditMa75UniverseCoverage(manifest,{exchangeSessions,observations,replay}={}){
 if(!verifyMa75ForwardManifest(manifest)||!Array.isArray(exchangeSessions)||
    !exchangeSessions.length||!Array.isArray(observations)||
    !Array.isArray(replay?.candidates)||replay.manifestSha256!==manifest.manifestSha256)
   throw new TypeError('Require frozen manifest, sessions, observations and matching replay');
 if(exchangeSessions.some((d,i)=>!day(d)||(i>0&&d<=exchangeSessions[i-1])||
    d<manifest.firstSignalDate))
   throw new TypeError('Need unique ordered valid forward exchange sessions');
 const sessionSet=new Set(exchangeSessions),universe=new Set(manifest.codes);
 const counts=new Map(),accepted=new Map(),excluded=[];
 for(const row of observations){
   const id=key(row?.code,row?.tradeDate);
   counts.set(id,(counts.get(id)||0)+1);
 }
 for(const row of observations){
   const id=key(row?.code,row?.tradeDate);
   let reason=null;
   if(!universe.has(row?.code)||!sessionSet.has(row?.tradeDate))
     reason='OUTSIDE_FROZEN_POPULATION';
   else if(counts.get(id)!==1)reason='DUPLICATE_CODE_DAY';
   else if(!['BREAKOUT','NO_CROSS','DATA_MISSING','QUARANTINED'].includes(row?.classification))
     reason='INVALID_CLASSIFICATION';
   else if(row.classification==='DATA_MISSING'||row.classification==='QUARANTINED'){
     if(typeof row.reason!=='string'||row.reason.trim().length<6)reason='MISSING_EXCLUSION_REASON';
   }else {
     const close=Date.parse(row.tradeDate+'T06:30:00Z');
     const closed=timestamp(row.barClosedAt),captured=timestamp(row.capturedAt);
     const classified=timestamp(row.classifiedAt);
     const deadline=timestamp(row.nextOpenAt);
     const nextSession=exchangeSessions[exchangeSessions.indexOf(row.tradeDate)+1]??null;
     if(![closed,captured,classified,deadline].every(Number.isFinite)||
       closed!==close||captured<close||classified<captured||classified>=deadline||
       deadline<=close||(nextSession!==null&&deadline!==Date.parse(nextSession+'T00:00:00Z')))
       reason='INVALID_ASOF_TRACE';
     else if(row.sourceProvider!==manifest.source.provider)
       reason='SOURCE_MISMATCH';
     else if(![row.close,row.priorClose,row.sma75,row.priorSma75].every(number))
       reason='INVALID_PRICE_FACTORS';
     else if((row.classification==='BREAKOUT')!==signalOf(row))
       reason='INCONSISTENT_CROSSOVER';
   }
   if(reason)excluded.push({id,reason});
   else accepted.set(id,row);
 }
 const replayCount=new Map(),replayById=new Map();
 for(const r of replay.candidates){
   const id=key(r?.code,r?.tradeDate);
   replayCount.set(id,(replayCount.get(id)||0)+1);
   if(!replayById.has(id)) replayById.set(id,r);
 }
 for(const [id,n] of replayCount){
   if(n!==1)excluded.push({id,reason:'DUPLICATE_REPLAY_SIGNAL'});
   const item=accepted.get(id);
   if(!item||item.classification!=='BREAKOUT')
     excluded.push({id,reason:'REPLAY_SIGNAL_NOT_IN_FROZEN_LEDGER'});
   else {
     const replayed=replayById.get(id);
     if(!number(replayed?.closingPrice)||!number(replayed?.sma75)||
        Math.abs(replayed.closingPrice-item.close)>0.001||
        Math.abs(replayed.sma75-item.sma75)>0.001||
        timestamp(replayed?.signalRecordedAt)!==timestamp(item.classifiedAt))
       excluded.push({id,reason:'REPLAY_PRICE_OR_TIME_MISMATCH'});
   }
 }
 for(const [id,row] of accepted){
   if(row.classification==='BREAKOUT'&&!replayCount.has(id))
     excluded.push({id,reason:'LEDGER_BREAKOUT_NOT_IN_REPLAY'});
 }
 const missing=[],byDate=[];
 for(const d of exchangeSessions){
   let acceptedCount=0,missingCount=0;
   for(const code of manifest.codes){
     const id=key(code,d);
     if(counts.get(id)!==1||!accepted.has(id)){
       missingCount++;
       if(missing.length<200)missing.push(id);
     }else if(accepted.get(id).classification==='DATA_MISSING'||accepted.get(id).classification==='QUARANTINED')
       missingCount++;
     else acceptedCount++;
   }
   byDate.push({tradeDate:d,validObserved:acceptedCount,unavailable:missingCount});
 }
 const total=manifest.codes.length*exchangeSessions.length;
 const traced=byDate.reduce((a,b)=>a+b.validObserved,0);
 const listedMissing=observations.filter(r=>r?.classification==='DATA_MISSING').length;
 const listedQuarantined=observations.filter(r=>r?.classification==='QUARANTINED').length;
 const breakoutRows=[...accepted.values()].filter(r=>r.classification==='BREAKOUT').length;
 const noCrossRows=[...accepted.values()].filter(r=>r.classification==='NO_CROSS').length;
 const integrityPass=excluded.length===0&&traced===total;
 return {
   version:MA75_UNIVERSE_COVERAGE_VERSION,manifestSha256:manifest.manifestSha256,
   universeCodes:manifest.codes.length,sessionCount:exchangeSessions.length,
   expectedCodeDates:total,rawRows:observations.length,
   observedBreakouts:breakoutRows,observedNoCross:noCrossRows,
   declaredMissing:listedMissing,declaredQuarantined:listedQuarantined,
   validObservedCodeDates:traced,coveragePercent:percent(traced,total),
   unavailableCodeDates:total-traced,missingSamples:missing,byDate,
   excluded,integrityPass,
   independentlyAuthenticatedCoverage:false,
   eligibleForProduction:false,validatedWinRate:null,
   warnings:[
     'Even 100% structural coverage does not prove an unbiased or independently timestamped provider feed.',
     'No crossed signal must be inferred from a missing row; explicit NO_CROSS evidence is required.',
     'All expected stock-day observations are preserved in the denominator, not just winning breakout trades.',
   ],
 };
}
