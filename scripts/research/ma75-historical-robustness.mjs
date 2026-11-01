/**
 * SHADOW ONLY: diagnostic stability of MA75 retrospective signal events.
 *
 * Deterministic, signal-time-ordered first-choice non-overlap per security,
 * without using return or future-retest to select events. Also show equal
 * weighting per signal date instead of overweighting event-packed sessions.
 *
 * This is still selected-after-the-fact descriptive history, NOT new held-out
 * evidence, independent event counts, statistical significance or execution.
 * No IO, network, credentials, external market orders, or notifications.
 */
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const round=(v,digits=4)=>Number(v.toFixed(digits));
const avg=values=>values.length?
 round(values.reduce((a,b)=>a+b,0)/values.length):null;
const dateOf=s=>new Date(s.signalTime*1000).toISOString().slice(0,10);
const closed=s=>s.outcome5Status==='COMPLETED'&&finite(s.return5Percent);
// Each recorded return already assumes 0.1% entry and 0.1% exit friction.
// Reprice the same entry/exit gross price ratio at extra symmetric friction,
// rather than simply subtracting percentage points from an arithmetic mean.
const ORIGINAL_FRICTION_PER_SIDE=0.001;
const EXTRA_ROUNDTRIP_PERCENT=Object.freeze([0,0.10,0.20,0.40]);
function repriceNetReturnPercent(returnPercent,additionalRoundTripPercent){
 const perSide=additionalRoundTripPercent/200;
 if(additionalRoundTripPercent===0)return returnPercent;
 const ratio=(1-ORIGINAL_FRICTION_PER_SIDE-perSide)/
             (1-ORIGINAL_FRICTION_PER_SIDE)*
             (1+ORIGINAL_FRICTION_PER_SIDE)/
             (1+ORIGINAL_FRICTION_PER_SIDE+perSide);
 return ((1+returnPercent/100)*ratio-1)*100;
}
function costScenario(rows,additionalRoundTripPercent){
 const completed=rows.filter(closed);
 const byDate=new Map();
 const values=[];
 for(const s of completed){
  const r=repriceNetReturnPercent(s.return5Percent,additionalRoundTripPercent);
  values.push(r);
  const date=dateOf(s),dateValues=byDate.get(date)??[];
  dateValues.push(r);byDate.set(date,dateValues);
 }
 return {
  completed:completed.length,
  meanNetReturn5Percent:avg(values),
  dateEqualWeightedMeanNetReturn5Percent:avg([...byDate.values()].map(avg)),
  winRatePercent:completed.length?
   round(100*values.filter(x=>x>0).length/completed.length,2):null
 };
}
function summarizeFixedRows(rows){
 const completed=rows.filter(closed),dates=new Map();
 for(const r of completed){
  const d=dateOf(r),g=dates.get(d)??[];
  g.push(r.return5Percent);dates.set(d,g);
 }
 const dateMeans=[...dates.values()].map(avg);
 return {
  signals:rows.length,
  completed:completed.length,
  pending:rows.filter(r=>r.outcome5Status==='PENDING').length,
  quarantined:rows.filter(r=>r.outcome5Status==='QUARANTINED_GAP').length,
  distinctCodes:new Set(rows.map(r=>r.code)).size,
  distinctSignalDates:new Set(rows.map(dateOf)).size,
  completedSignalDates:dates.size,
  completedWinRatePercent:completed.length?
   round(100*completed.filter(s=>s.return5Percent>0).length/completed.length,2):null,
  completedTradeWeightedAverage5Percent:avg(completed.map(s=>s.return5Percent)),
  completedSignalDateEqualWeightedAverage5Percent:avg(dateMeans),
  worstCompletedSignalDateMeanPercent:dateMeans.length?round(Math.min(...dateMeans)):null,
  bestCompletedSignalDateMeanPercent:dateMeans.length?round(Math.max(...dateMeans)):null,
 };
}
export function analyzeMa75RetrospectiveRobustness(rows){
 if(!Array.isArray(rows))throw new TypeError('MA75_ROBUSTNESS_INPUT_ARRAY_REQUIRED');
 const ordered=[...rows];
 for(const s of ordered){
  if(s?.kind!=='BREAKOUT'||typeof s.code!=='string'||
   !Number.isSafeInteger(s.signalIndex)||s.signalIndex<75||
   !Number.isSafeInteger(s.signalTime)||s.signalTime<=0||
   !['COMPLETED','PENDING','QUARANTINED_GAP'].includes(s.outcome5Status)||
   (s.outcome5Status==='COMPLETED'?!finite(s.return5Percent):
    s.return5Percent!==null))
   throw new TypeError('MA75_ROBUSTNESS_EVENT_INVALID');
 }
 ordered.sort((a,b)=>a.code.localeCompare(b.code)||
  a.signalIndex-b.signalIndex||a.signalTime-b.signalTime);
 const previousChosenIndex=new Map(),earliest=[];
 for(const signal of ordered){
  const last=previousChosenIndex.get(signal.code);
  if(last===undefined||signal.signalIndex>last+5){
   earliest.push(signal);
   previousChosenIndex.set(signal.code,signal.signalIndex);
  }
 }
 const all=summarizeFixedRows(ordered);
 const noOverlap=summarizeFixedRows(earliest);
 return {
  version:'ma75_historical_dependence_check_v1',
  resultType:'DESCRIPTIVE_STRESS_CHECK_NOT_HOLDOUT',
  allSignals:all,
  earliestNonOverlappingPerCode:noOverlap,
  incrementalExecutionFrictionSensitivity:EXTRA_ROUNDTRIP_PERCENT.map(additionalRoundTripPercent=>({
   additionalRoundTripPercent,
   allBreakouts:costScenario(ordered,additionalRoundTripPercent),
   earliestNonOverlappingPerCode:costScenario(earliest,additionalRoundTripPercent)
  })),
  originalAssumedPerSideFrictionPercent:0.1,
  additionalFrictionAppliedSymmetricallyPerSide:true,
  additionalFrictionScenariosAreCounterfactualNotObservedFees:true,
  nonOverlapDefinition:'GREEDY_EARLIEST_BY_CODE_SIGNAL_INDEX_WITH_FIVE_SESSION_EXCLUSION',
  excludesFollowingFiveSessionSignalsWithoutLookingAtFutureOutcome:true,
  eventCountNotIndependentAcrossStocksOrCalendarDates:true,
  dateEqualWeightNotCausalOrPortfolioSimulation:true,
  candidateSelectionIsPostHoc:true,
  signalTimeEventClusterMayRemainCorrelated:true,
  futureKnowledgeUsedForTradeSelection:false,
  independentForwardValidation:false,
  eligibleForProduction:false,
  eligibleForNotifications:false,
  eligibleForTrading:false,
 };
}
