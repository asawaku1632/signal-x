/**
 * Shadow-only, descriptive historical check of ex-ante breakout features.
 * Uses ONLY features known at the breakout day's completed close.
 *
 * Not an independent holdout: thresholds are reviewed after seeing aggregate
 * historical results, 912 codes were selected by later data availability, and
 * overlapping same-code trades share market exposure.
 *
 * No I/O, API calls, production scores, notifications, or trading.
 */
import {analyzeMa75RetrospectiveRobustness} from './ma75-historical-robustness.mjs';

const fixedConditions=Object.freeze([
 {id:'ALL_BREAKOUTS',label:'All eligible breakout close signals',
  test:()=>true},
 {id:'RISING_MA75_AT_CLOSE',label:'75-session SMA rising at breakout close',
  test:s=>s.ma75Rising===true},
 {id:'VOLUME_GE_1_5X_PRIOR20_AT_CLOSE',
  label:'Signal day volume >= 1.5x prior 20 sessions',
  test:s=>typeof s.volumeRatio==='number'&&s.volumeRatio>=1.5},
 {id:'RISING_AND_VOLUME_GE_1_5X_AT_CLOSE',
  label:'Both rising SMA75 and >= 1.5x prior 20-session volume',
  test:s=>s.ma75Rising===true&&
    typeof s.volumeRatio==='number'&&s.volumeRatio>=1.5}
]);
const fmt=(x,decimals=4)=>Number(x.toFixed(decimals));
const average=values=>values.length
 ?fmt(values.reduce((a,b)=>a+b,0)/values.length):null;
const median=values=>{
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),m=Math.floor(sorted.length/2);
 return fmt(sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2);
};
const monthlyKey=s=>new Date(s.signalTime*1000).toISOString().slice(0,7);
const statusCounts=arr=>({
 total:arr.length,
 completed:arr.filter(s=>s.outcome5Status==='COMPLETED').length,
 pending:arr.filter(s=>s.outcome5Status==='PENDING').length,
 quarantined:arr.filter(s=>s.outcome5Status==='QUARANTINED_GAP').length,
 uniqueCodes:new Set(arr.map(s=>s.code)).size,
});
function summarize(arr){
 const count=statusCounts(arr);
 const completed=arr.filter(s=>s.outcome5Status==='COMPLETED'&&
  typeof s.return5Percent==='number'&&Number.isFinite(s.return5Percent));
 if(completed.length!==count.completed)
  throw new TypeError('INVALID_COMPLETED_FIVE_DAY_OUTCOME');
 const ret=completed.map(s=>s.return5Percent);
 const gains=ret.filter(x=>x>0).length;
 const budget=completed.filter(s=>s.budgetEligible===true);
 return {
  ...count,
  winRatePercent:completed.length?fmt(100*gains/completed.length,2):null,
  averageReturn5Percent:average(ret),
  medianReturn5Percent:median(ret),
  worstReturn5Percent:ret.length?fmt(Math.min(...ret)):null,
  averageProfit5Yen100:completed.length?
   fmt(completed.reduce((n,s)=>n+s.profit5Yen100,0)/completed.length,0):null,
  budgetAtActualNextOpenCompleted:budget.length,
  budgetAtActualNextOpenAverageReturn5Percent:average(
   budget.map(s=>s.return5Percent)
  )
 };
}
export function analyzeMa75HistoricalPrecloseConditions(observations){
 if(!Array.isArray(observations))throw new TypeError('NEED_OFFLINE_MA75_OBSERVATIONS');
 const breakout=observations.filter(s=>s?.kind==='BREAKOUT');
 for(const s of breakout){
  if(typeof s.code!=='string'||!Number.isSafeInteger(s.signalTime)||
    typeof s.ma75Rising!=='boolean'||
    (s.volumeRatio!==null&&
      (typeof s.volumeRatio!=='number'||!Number.isFinite(s.volumeRatio)))||
    !['COMPLETED','PENDING','QUARANTINED_GAP'].includes(s.outcome5Status))
   throw new TypeError('INVALID_BREAKOUT_OBSERVATION');
 }
 const groups=fixedConditions.map(condition=>{
  const rows=breakout.filter(condition.test);
  const months=[...new Set(rows.map(monthlyKey))].sort();
  return {
   condition:condition.id,
   definition:condition.label,
   ...summarize(rows),
   dependenceStressCheck:analyzeMa75RetrospectiveRobustness(rows),
   signalMonthBreakdown:months.map(month=>({
    month,...summarize(rows.filter(s=>monthlyKey(s)===month))
   }))
  };
 });
 return {
  version:'ma75_historical_preclose_condition_review_v1',
  status:'EXPLORATORY_HISTORICAL_DESCRIPTIVE_ONLY',
  featureCutoff:'BREAKOUT_SIGNAL_DAY_COMPLETED_CLOSE',
  entry:'NEXT_TRADING_SESSION_OPEN_ASSUMED',
  exit:'CLOSE_OF_FIFTH_SESSION_AFTER_SIGNAL',
  adjustment:'0.1_PERCENT_PER_SIDE_ASSUMED',
  conditions:groups,
  distinction:'BUDGET_ELIGIBLE_FROM_ACTUAL_NEXT_OPEN_IS_EX_POST_EXECUTION_DIAGNOSTIC_ONLY',
  trueIndependentChronologicalHoldout:false,
  thresholdChosenAfterAggregateReview:true,
  sampleSelectedAfterHistoricalWindow:true,
  sameStockSignalsMayOverlap:true,
  full953HeadlineResults:null,
  independentlyValidatedWinRate:null,
  eligibleForProduction:false,
  eligibleForNotifications:false,
  eligibleForTrading:false
 };
}
