/**
 * Pure outcomes after one externally sealed new MA75 signal date.
 * Retrospective original-bar simulations, NEVER evidence of broker fills,
 * real-time as-of availability, independent J-Quants rights or tradability.
 * Membership is fixed at signal-date lock. Budget is contingent on next OPEN.
 */
import {verifyMa75NextDateCohort,requireMa75ProspectivePolicy}
 from './ma75ProspectiveDateCohort.mjs';
const fail=s=>{throw new TypeError('MA75_NEXT_OUTCOME_'+s)};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=(x,d=4)=>Number(x.toFixed(d));
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const groups=['allBreakouts','risingBreakouts','nonRisingBreakouts',
 'budgetEligibleBreakouts','budgetEligibleRising','budgetEligibleNonRising'];
const cleanBar=(row,date,code)=>{
 const b=row?.bar;
 return b&&row.code===code&&row.tradeDate===date&&
  row.status==='DAILY_BAR'&&b.code===code&&b.tradeDate===date&&
  [b.open,b.high,b.low,b.close,b.volume].every(finite)&&
  b.open>0&&b.close>0&&b.low>0&&b.volume>0&&
  b.high>=Math.max(b.open,b.close,b.low)&&
  b.low<=Math.min(b.open,b.close,b.high)&&
  b.high>b.low;
};
const sourceMap=(projection,date)=>{
 if(projection?.date!==date||
    projection.completeProviderPagination!==true||
    !Array.isArray(projection.audit?.rows)||
    projection.audit.rows.length!==953||
    projection.audit.failures?.length!==0||
    projection.originalAllListedRows<953)
  fail('INVALID_ORIGINAL_DAY_PROJECTED');
 const entries=new Map();
 for(const row of projection.audit.rows){
  if(!/^[0-9]{3}[0-9A-Z]$/.test(row?.code??'')||
     entries.has(row.code)||row.tradeDate!==date||
     typeof row.status!=='string')
   fail('WRONG_OR_DUPLICATE_ORIGINAL_DAY_ROW');
  entries.set(row.code,row);
 }
 if(entries.size!==953)fail('NOT_FULL_FROZEN_POPULATION');
 return entries;
};
function summarize(rows){
 const complete=rows.filter(r=>r.status==='HYPOTHETICAL_OUTCOME_ONLY');
 const n=complete.length;const returns=complete.map(x=>x.netReturnPercent).sort((a,b)=>a-b);
 const o={frozenGroupCount:rows.length,measured:n,
  pending:rows.filter(x=>x.status.startsWith('PENDING_')).length,
  quarantined:rows.filter(x=>x.status.startsWith('QUARANTINED_')).length,
  positiveCount:0,positiveRatePercent:null,meanNetReturnPercent:null,
  medianNetReturnPercent:null,meanProfitYen100:null,
  leaveLargestWinnerOutMeanPercent:null,largestWinnerCode:null,
  leaveLargestLoserOutMeanPercent:null,largestLoserCode:null,
  largestWinnerReturnPercent:null,largestLoserReturnPercent:null};
 if(!n)return o;
 const total=returns.reduce((a,b)=>a+b,0);
 const half=Math.floor(n/2);
 const best=[...complete].sort((a,b)=>b.netReturnPercent-a.netReturnPercent||
   a.code.localeCompare(b.code))[0];
 const worst=[...complete].sort((a,b)=>a.netReturnPercent-b.netReturnPercent||
   a.code.localeCompare(b.code))[0];
 return {...o,positiveCount:returns.filter(x=>x>0).length,
  positiveRatePercent:round(100*returns.filter(x=>x>0).length/n,2),
  meanNetReturnPercent:round(total/n),
  medianNetReturnPercent:n%2?returns[half]:round((returns[half-1]+returns[half])/2),
  meanProfitYen100:round(mean(complete.map(x=>x.profitYen100)),2),
  largestWinnerCode:best.code,largestWinnerReturnPercent:best.netReturnPercent,
  largestLoserCode:worst.code,largestLoserReturnPercent:worst.netReturnPercent,
  leaveLargestWinnerOutMeanPercent:n<2?null:
   round((total-best.netReturnPercent)/(n-1)),
  leaveLargestLoserOutMeanPercent:n<2?null:
   round((total-worst.netReturnPercent)/(n-1))};
}
const groupRows=rows=>{
 const r=rows.filter(x=>x.budgetEligible===true);
 const defs={
  allBreakouts:rows,risingBreakouts:rows.filter(x=>x.risingMA75),
  nonRisingBreakouts:rows.filter(x=>!x.risingMA75),
  budgetEligibleBreakouts:r,budgetEligibleRising:r.filter(x=>x.risingMA75),
  budgetEligibleNonRising:r.filter(x=>!x.risingMA75)
 };
 return Object.fromEntries(groups.map(name=>[name,summarize(defs[name])]));
};

export function evaluateMa75ProspectiveDateOutcomes(cohort,policy,{
 sourceByDate={},receiptByDate={},signalCloseByCode,
 now='2026-11-11T08:00:00Z'
}={}){
 requireMa75ProspectivePolicy(policy);
 if(!verifyMa75NextDateCohort(cohort,policy))
  fail('INVALID_OR_MUTATED_NEW_DATE_LOCK');
 const at=Date.parse(now),start=Date.parse(cohort.lockedAt);
 if(!Number.isFinite(at)||at<start)fail('ASOF_BEFORE_COHORT_LOCK');
 if(!(signalCloseByCode instanceof Map)||
    signalCloseByCode.size!==cohort.candidates.length||
    cohort.candidates.some(x=>!finite(signalCloseByCode.get(x.code))||
     signalCloseByCode.get(x.code)<=0))
  fail('MISSING_OR_UNTRUSTED_SIGNAL_DAY_CLOSING_BAR');
 const dates=policy.horizonSessions;
 if(Object.keys(sourceByDate).some(x=>!dates.includes(x))||
    Object.keys(receiptByDate).some(x=>!dates.includes(x)))
  fail('FUTURE_OR_NONPREDECLARED_SOURCE_DATE');
 const projected=new Map();
 for(const date of dates){
  if(sourceByDate[date]===undefined)continue;
  const stamp=Date.parse(receiptByDate[date]);
  if(!Number.isFinite(stamp)||stamp< Date.parse(date+'T07:30:00Z')||
    stamp>at||stamp<start)
   fail('SOURCE_RECEIPT_NOT_AFTER_ITS_CLOSE_OR_LOCK');
  projected.set(date,sourceMap(sourceByDate[date],date));
 }
 const first=dates[0],firstMap=projected.get(first);
 const rowsByHorizon=[],horizonSummaries={};
 for(const h of policy.horizonOffsets){
  const required=dates.slice(0,h);
  const rows=[];
  for(const c of cohort.candidates){
   const initial=firstMap?.get(c.code);
   let entry=null,budgetEligible=null,budgetLots=null;
   let entryIssue=null;
   if(firstMap){
    if(!initial||['NO_TRADE','MISSING_PROVIDER_ROW'].includes(initial.status)){
     entryIssue='PENDING_FIRST_OPEN_NO_TRADE_OR_MISSING';
    }else if(!cleanBar(initial,first,c.code)){
     entryIssue='QUARANTINED_UNTRUSTED_ENTRY_OHLCV';
    }else if(Math.abs(initial.bar.open/signalCloseByCode.get(c.code)-1)>.45||
      Math.abs(initial.bar.close/signalCloseByCode.get(c.code)-1)>.45){
     entryIssue='QUARANTINED_UNVERIFIED_SIGNAL_TO_ENTRY_GAP';
    }else{
     entry=initial.bar.open;
     const amount=entry*100*(1+policy.singleHundredShareBuyFriction);
     const minimumLots=Math.max(1,Math.ceil(policy.budgetMinYen/amount));
     const maximumLots=Math.floor(policy.budgetMaxYen/amount);
     budgetEligible=maximumLots>=minimumLots;
     budgetLots=budgetEligible?{minimumLots,maximumLots}:null;
    }
   }
   let status='PENDING_REQUIRED_FUTURE_SESSIONS',reason=status,net=null,
    profit=null,worstLow=null;
   if(entryIssue){status=entryIssue;reason=status}
   else if(entry!==null){
    let priorClose=null,invalid=null;const lows=[];
    const missing=[];
    for(const date of required){
     const map=projected.get(date);
     if(!map){missing.push(date);continue}
     const row=map.get(c.code);
     if(!row||['NO_TRADE','MISSING_PROVIDER_ROW'].includes(row.status)){
      missing.push(date);continue
     }
     if(!cleanBar(row,date,c.code)){
      invalid='QUARANTINED_INVALID_INTERVENING_OHLCV';continue
     }
     const b=row.bar;
     if(priorClose!==null&&
        (Math.abs(b.open/priorClose-1)>.45||
         Math.abs(b.close/priorClose-1)>.45))
      invalid='QUARANTINED_INTERVENING_PRICE_DISCONTINUITY';
     priorClose=b.close;
     lows.push(b.low);
    }
    if(invalid){status=invalid;reason=status}
    else if(!missing.length&&lows.length===h){
     const exit=projected.get(required.at(-1)).get(c.code).bar.close;
     const buy=entry*(1+policy.singleHundredShareBuyFriction);
     const sell=exit*(1-policy.singleHundredShareSellFriction);
     net=round(100*(sell/buy-1));
     profit=round(100*(sell-buy),2);
     worstLow=round(100*(Math.min(...lows)/buy-1));
     status='HYPOTHETICAL_OUTCOME_ONLY';reason=null;
    }
   }
   rows.push({
    code:c.code,risingMA75:c.risingMA75,
    budgetEligible,budgetLots,horizonSessions:h,
    exitSession:required.at(-1),
    status,reason,netReturnPercent:net,profitYen100:profit,
    observedWorstLowPercent:worstLow,actualFillVerified:false
   });
  }
  const byGroup=groupRows(rows);
  const firstGroup=byGroup.allBreakouts;
  const unknown=rows.filter(x=>x.budgetEligible===null).length;
  if(firstGroup.frozenGroupCount!==cohort.allBreakouts||
    firstGroup.pending+firstGroup.quarantined+firstGroup.measured!==cohort.allBreakouts||
    byGroup.risingBreakouts.frozenGroupCount!==cohort.risingBreakouts||
    byGroup.nonRisingBreakouts.frozenGroupCount!==cohort.nonRisingBreakouts||
    byGroup.budgetEligibleRising.frozenGroupCount+
     byGroup.budgetEligibleNonRising.frozenGroupCount!==
     byGroup.budgetEligibleBreakouts.frozenGroupCount||
    byGroup.budgetEligibleBreakouts.frozenGroupCount+
     rows.filter(x=>x.budgetEligible===false).length+
     unknown!==cohort.allBreakouts)
   fail('DENOMINATOR_OR_BUDGET_ACCOUNTING');
  rowsByHorizon.push(...rows);
  horizonSummaries['session'+h]={
   exitSession:required.at(-1),allRequiredOriginalDaysPresent:
    required.every(d=>projected.has(d)),
   budgetUnassignedCodeCount:unknown,
   groups:byGroup
  };
 }
 return {
  version:'ma75_second_signal_1_3_5_observations_v1',
  status:'SHADOW_NOT_APPROVED',signalDate:cohort.signalDate,
  lockedBeforeEntry:true,ownerLocalLockSha256:cohort.lockSha256,
  originalBreakouts:cohort.allBreakouts,
  originalRisingBreakouts:cohort.risingBreakouts,
  originalNonRisingBreakouts:cohort.nonRisingBreakouts,
  sourcesObserved:[...projected.keys()],horizons:horizonSummaries,
  perFrozenCodeHorizon:rowsByHorizon,
  sourceTimingIndependentlyCertified:false,
  actualTradeExecutionVerified:false,
  independentlyValidatedForwardWinRate:null,
  eligibleForProduction:false,eligibleForAIPowerScoring:false,
  eligibleForNotifications:false,eligibleForTrading:false,
  filesWritten:0,networkRequests:0
 };
}
