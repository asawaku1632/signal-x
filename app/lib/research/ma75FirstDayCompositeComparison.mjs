/**
 * First post-freeze MA75 research comparison. PURE, SHADOW_NOT_APPROVED.
 * Existing 27 breakout codes / 22 rising codes are immutable, validated by
 * the previously frozen SHA256. Wick>=0.35 & volume>=1.5 are evaluated only
 * ON original breakout opportunities, using 75 historical completed sessions
 * and already captured 2026-11-02 close. No future bar or outcome access.
 *
 * Five earlier Yahoo-chart historical outcomes are from a different
 * convenience sample and are intentionally NOT accepted here.
 * No I/O, execution, scoring, alert or live trading.
 */
import {verifyMa75FirstDayResearchFreeze} from './ma75FirstDayResearchFreeze.mjs';
import {classifyMa75WickVolume,MA75_WICK_VOLUME_V1}
 from './ma75WickVolumeForward.mjs';

export const MA75_FIRST_COMPOSITE_VERSION='ma75_first_forward_composite_comparison_v1';
const fail=s=>{throw new TypeError('MA75_FIRST_COMPOSITE_'+s)};
const validDate=d=>typeof d==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(d)&&
  Number.isFinite(Date.parse(d+'T00:00:00Z'))&&
  new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const unix=d=>Math.floor(Date.parse(d+'T00:00:00Z')/1000);
const mean=a=>a.reduce((sum,value)=>sum+value,0)/a.length;

/** Exactly one {code,bars} per frozen breakout; no extras or winners-only subset. */
export function compareMa75FirstDayComposite(frozen,{
 priorDates,series
}={}){
 if(!verifyMa75FirstDayResearchFreeze(frozen)||
    frozen.firstForwardDate!=='2026-11-02'||
    frozen.priorHistoryLast!=='2026-10-30'||
    !Array.isArray(priorDates)||priorDates.length!==75||
    priorDates.some((d,i)=>!validDate(d)||
      (i>0&&d<=priorDates[i-1])||d>=frozen.firstForwardDate)||
    priorDates.at(-1)!==frozen.priorHistoryLast)
  fail('INVALID_IMMUTABLE_COHORT_OR_SESSIONS');
 const group=frozen.breakoutsAll,ids=new Set(group.map(x=>x.code));
 if(!Array.isArray(series)||series.length!==group.length||
   series.some(s=>typeof s?.code!=='string'||!ids.has(s.code))||
   new Set(series.map(s=>s.code)).size!==group.length)
  fail('NO_RESELECTION_OR_MISSING_FROZEN_BREAKOUTS');
 const source=new Map(series.map(s=>[s.code,s.bars]));
 const sessions=[...priorDates,frozen.firstForwardDate];
 const comparisons=[],failures={};
 let analyzable=0,compound=0,risingCompound=0;
 for(const item of group){
  const bars=source.get(item.code);
  let reason=null;
  if(!Array.isArray(bars)||bars.length!==sessions.length){
   reason='MISSING_FROZEN_SOURCE_SESSIONS';
  }else if(bars.some((bar,i)=>!bar||bar.time!==unix(sessions[i]))){
   reason='WRONG_OR_FUTURE_TRADING_SESSION';
  }
  if(reason){
   failures[reason]=(failures[reason]??0)+1;
   comparisons.push({code:item.code,risingMA75:item.sma75Rising,
    classification:'NOT_EVALUABLE',reason,
    upperWickRatio:null,volumeRatio:null,
    compoundMatched:null,return1Percent:null,return3Percent:null,
    return5Percent:null});
   continue;
  }
  const priorMA=mean(bars.slice(0,75).map(x=>x.close));
  const signalMA=mean(bars.slice(1,76).map(x=>x.close));
  const c=classifyMa75WickVolume({
   bars,signalIndex:75,ma75Today:signalMA,ma75Prior:priorMA
  });
  // Source has to match the existing freeze. Never silently delete
  // inconvenient control-group signals on a mismatch.
  if(c.status!=='SHADOW_ONLY'||c.breakout!==true||
     (signalMA>priorMA)!==item.sma75Rising||
     (item.historicalVolumeRatio!==null&&
      Math.abs(c.volumeRatio-item.historicalVolumeRatio)>0.00011))
   fail('SOURCE_OR_FROZEN_SIGNAL_DISAGREEMENT');
  analyzable++;
  const matched=c.eligible===true;
  if(matched){compound++;if(item.sma75Rising)risingCompound++}
  comparisons.push({
   code:item.code,risingMA75:item.sma75Rising,
   classification:matched?'COMPOUND_SHADOW_MATCH':'BASELINE_BREAKOUT_ONLY',
   reason:null,upperWickRatio:Number(c.upperWickRatio.toFixed(5)),
   volumeRatio:Number(c.volumeRatio.toFixed(5)),compoundMatched:matched,
   provenanceStatus:c.provenanceStatus,
   return1Percent:null,return3Percent:null,return5Percent:null
  });
 }
 if(comparisons.length!==frozen.breakoutsTotal||analyzable+
    Object.values(failures).reduce((a,b)=>a+b,0)!==frozen.breakoutsTotal)
  fail('COUNT_RECONCILIATION');
 return {
  version:MA75_FIRST_COMPOSITE_VERSION,status:'SHADOW_NOT_APPROVED',
  signalDate:frozen.firstForwardDate,
  frozenCohortSha256:frozen.freezeSha256,
  originalCapturedSourceSha256:frozen.capturedSourceSha256,
  originalHistoricalWarmupSha256:frozen.historicalWarmupSourceSha256,
  originalFrozenPopulation:frozen.frozenPopulation,
  historicalPreselectedYahooCasesMixedIn:false,
  wickFractionMinimum:MA75_WICK_VOLUME_V1.upperWickMinimum,
  volumeRatioMinimum:MA75_WICK_VOLUME_V1.volumeRatioMinimum,
  originalAllBreakouts:frozen.breakoutsTotal,
  originalRisingBreakouts:frozen.risingBreakoutCount,
  firstDayWickAndVolumeComposite:compound,
  firstDayRisingAndComposite:risingCompound,
  comparedCompleteOriginalBreakouts:analyzable,
  notEvaluableBreakouts:frozen.breakoutsTotal-analyzable,
  notEvaluableReasons:failures,
  perFrozenBreakout:comparisons,
  sourceOrigin:'ORIGINAL_JQUANTS_V2_LOCAL_FILES_ONLY',
  eligibleForProduction:false,eligibleForNotifications:false,
  eligibleForTrading:false,eligibleForAIPowerScoring:false,
  frozenCohortUnmodified:true,
  firstDayCompositeRetrospectiveTechnicalSubgroupOnly:true,
  independentlyAuthenticatedCaptureTime:false,
  officialTradingCalendarAndProviderRightsNotCertified:true,
  independentlyValidatedForwardOutcomes:0,
  hypotheticalOutcomeStatus:'NOT_YET_OBSERVED',
  nextOpenPrice:null,return1Percent:null,return3Percent:null,
  return5Percent:null,positiveRatePercent:null,
  note:'A captured postfreeze bar gives a retrospective technical classification, not independent verification of its availability before the next market open.'
 };
}
