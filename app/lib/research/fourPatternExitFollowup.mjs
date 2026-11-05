/**
 * Strict after-window 5-TSE-session outcome audit for the six predeclared
 * research stocks. Private J-Quants captures are NEVER joined for signal
 * detection: the original 20 sessions alone generate frozen signals, while
 * the independent five-session tail provides exit prices only.
 * No network, order, notification or database side effects.
 */
import {REPLICATION_PLAN,verifyFourPatternReplicationPlan}
 from './fourPatternReplicationPlan.mjs';
import {reconcileCapturedTradeDay,aggregateReconciledMinutes,
 studyCapturedJQuantsFourPatterns} from './fourPatternJQuantsBridge.mjs';
import {evaluateTradingDaySignals,assertContinuousTseSessions}
 from './fourPatternTradingDayForward.mjs';
import {summarizeVerifiedMultiStockFourPatternEvaluations}
 from './fourPatternMultiStockShadow.mjs';
import {TSE_MARKET_CALENDAR,resolveTseTradingDatesAfter}
 from '../technicalObservation/tseMarketCalendar.ts';

export const FOUR_PATTERN_EXIT_FOLLOWUP_VERSION='four_pattern_exit_followup_private_v1';
const fail=s=>{throw new TypeError(s)};
const successful='RETROSPECTIVE_TSE_DAY_EVALUATION_SHADOW_ONLY';
const originalStatus='HISTORICAL_RECONCILED_SHADOW_ONLY';
function codeOk(c){return typeof c==='string'&&/^[0-9]{3}[0-9A-Z]$/.test(c)}
const exact=(got,expected)=>Array.isArray(got)&&got.length===expected.length&&
 got.every((v,i)=>v===expected[i]);
const statusBlocked=(code,reason)=>({
 version:FOUR_PATTERN_EXIT_FOLLOWUP_VERSION,
 code:codeOk(code)?code:null,status:'BLOCKED_'+reason,
 eligibleForNotifications:false,eligibleForProduction:false,
 canTriggerTrade:false,results:[],
});
const safeReason=e=>e instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(e.message)?
 e.message:'UNVERIFIED_OR_INVALID_CAPTURE';
const pairDates=(archive)=>{
 if(!Array.isArray(archive?.minuteDays)||!Array.isArray(archive?.dailyDays)||
 archive.minuteDays.length!==archive.dailyDays.length)
  fail('MISSING_OR_UNPAIRED_DATES');
 const days=archive.minuteDays.map((m,i)=>{
  if(typeof m?.date!=='string'||m.date!==archive.dailyDays[i]?.date)
   fail('MISSING_OR_UNPAIRED_DATES');
  return m.date;
 });
 return days;
};
function validateArchive({archive,expectedCode,expectedDates}){
 if(archive?.code!==expectedCode)fail('WRONG_ARCHIVE_STOCK_CODE');
 if(archive.financialPages!==null)fail('FINANCIAL_PAGES_NOT_ALLOWED');
 const dates=pairDates(archive);
 if(!exact(dates,expectedDates))fail('ARCHIVE_DATES_OUTSIDE_FROZEN_PLAN');
 // The same independently audited raw pages and corporate action checks as
 // the original capture bridge apply to every day in both archives.
 return dates.map((date,i)=>reconcileCapturedTradeDay({
  code:expectedCode,date,minutePages:archive.minuteDays[i].pages,
  dailyPages:archive.dailyDays[i].pages,
 }));
}
function assertFrozenSignalIdentity(before,after){
 if(before.status!==after.status||before.originalSignals!==after.originalSignals||
    before.duplicateSameDayStrategySignalsDiscarded!==
    after.duplicateSameDayStrategySignalsDiscarded||
    before.signals.length!==after.signals.length)
  fail('FROZEN_SIGNAL_IDENTITY_CHANGED');
 for(let i=0;i<before.signals.length;i++){
  const a=before.signals[i],b=after.signals[i];
  if(a.strategy!==b.strategy||a.signalTime!==b.signalTime||
     a.signalDate!==b.signalDate||
     a.outcomes.length!==b.outcomes.length)
   fail('FROZEN_SIGNAL_IDENTITY_CHANGED');
  for(let k=0;k<a.outcomes.length;k++){
   const beforeResult=a.outcomes[k],extendedResult=b.outcomes[k];
   if(beforeResult.horizonTradingDays!==extendedResult.horizonTradingDays||
     beforeResult.entryDate!==extendedResult.entryDate||
     beforeResult.exitDate!==extendedResult.exitDate)
    fail('OUTCOME_DATES_CHANGED');
   // A measured result must never change; a pending one may resolve once
   // the independently reconciled official tail closes.
   if(beforeResult.status!=='PENDING'&&
      JSON.stringify(beforeResult)!==JSON.stringify(extendedResult))
    fail('PREVIOUSLY_MEASURED_OUTCOME_CHANGED');
   if(beforeResult.status==='PENDING'&&
      !['PENDING','HISTORICAL_HYPOTHETICAL_ONLY','BUDGET_EXCLUDED']
      .includes(extendedResult.status))
    fail('PENDING_OUTCOME_INVALID_TRANSITION');
  }
 }
}
export function pinnedExitFollowupDates({
 plan=REPLICATION_PLAN,calendar=TSE_MARKET_CALENDAR,
}={}){
 const check=verifyFourPatternReplicationPlan({plan,calendar});
 if(check.status!=='PREDECLARED_HOLDOUT_PLAN_ONLY')
  fail('PREREGISTERED_PLAN_UNVERIFIED');
 const dates=resolveTseTradingDatesAfter(plan.plannedNextPeriod.end,5,{calendar});
 if(!exact(dates,['2026-12-07','2026-12-08','2026-12-09',
                   '2026-12-10','2026-12-11']))
  fail('FOLLOWUP_CALENDAR_DATES_UNEXPECTED');
 return dates;
}
/** Full 20-day signal archive plus full 5-day follow-up archive, same code. */
export function evaluateFrozenFourPatternExitFollowup({
 originalArchive,followupArchive,plan=REPLICATION_PLAN,
 calendar=TSE_MARKET_CALENDAR,
}={}){
 const code=originalArchive?.code??null;
 try{
  const tail=pinnedExitFollowupDates({plan,calendar});
  if(!plan.plannedNextPeriod.codes.includes(code))
   fail('UNREGISTERED_STOCK_CODE');
  const originalSessions=validateArchive({
   archive:originalArchive,expectedCode:code,
   expectedDates:plan.plannedNextPeriod.tradingDates,
  });
  const followupSessions=validateArchive({
   archive:followupArchive,expectedCode:code,expectedDates:tail,
  });
  const originalAudit=assertContinuousTseSessions(originalSessions,{calendar});
  const completeSessions=[...originalSessions,...followupSessions];
  const entireAudit=assertContinuousTseSessions(completeSessions,{calendar});
  if(originalAudit.verifiedSessions!==20||entireAudit.verifiedSessions!==25)
   fail('INVALID_FROZEN_SESSION_COUNTS');
  const base=studyCapturedJQuantsFourPatterns({
   ...originalArchive,timeframe:'BOTH',
  });
  if(base.status!==originalStatus||base.reconciledDates.length!==20||
     base.financialStatus!=='NO_FINANCIAL_ARCHIVE')
   fail('ORIGINAL_PATTERN_STUDY_UNVERIFIED');
  const results=base.reports.map(({timeframe,report})=>{
   const candles=aggregateReconciledMinutes(originalSessions,
    timeframe==='30m'?30:60);
   const before=evaluateTradingDaySignals({
    report,candles,sessions:originalSessions,calendar,
   });
   const after=evaluateTradingDaySignals({
    report,candles,sessions:completeSessions,calendar,
   });
   if(before.status!=='TSE_CALENDAR_VERIFIED_RETROSPECTIVE_ONLY'||
      after.status!=='TSE_CALENDAR_VERIFIED_RETROSPECTIVE_ONLY')
    fail('ORIGINAL_PATTERN_HISTORY_INSUFFICIENT');
   assertFrozenSignalIdentity(before,after);
   const resolved=before.signals.flatMap((signal,i)=>signal.outcomes.map(
    (o,k)=>o.status==='PENDING'&&
    after.signals[i].outcomes[k].status!=='PENDING'?1:0,
   )).reduce((a,b)=>a+b,0);
   return {timeframe,intradaySignalCount:report.rows.length,
    resolvedPendingOutcomes:resolved,...after};
  });
  if(results.length!==2||results[0].timeframe!=='30m'||
     results[1].timeframe!=='60m')
   fail('ORIGINAL_PATTERN_TIMEFRAMES_CHANGED');
  return {
   version:FOUR_PATTERN_EXIT_FOLLOWUP_VERSION,
   status:successful,code,results,
   originalMinuteBars:base.capturedOriginalMinutes,
   followupMinuteBars:followupSessions.reduce((s,d)=>s+d.minuteBarCount,0),
   validatedTradeDates:originalAudit.verifiedSessions,
   validatedFollowupTradeDates:followupSessions.length,
   continuousCalendarVersion:entireAudit.calendarVersion,
   originalSignalWindow:{start:plan.plannedNextPeriod.start,
    end:plan.plannedNextPeriod.end},
   outcomeOnlyTail:{first:tail[0],last:tail.at(-1)},
   source:'JQUANTS_V2_HISTORICAL_PRIVATE_CAPTURE_NO_LIVE_PROVENANCE',
   noSignalsFromFollowup:true,
   financialStatus:base.financialStatus,
   eligibleForNotifications:false,eligibleForProduction:false,
   actualSignalAvailabilityAtDecisionTimeProven:false,
   forwardProspectiveValidationCompleted:false,
  };
 }catch(error){return statusBlocked(code,safeReason(error))}
}
export function evaluateFrozenFourPatternExitCohort(items,{
 plan=REPLICATION_PLAN,calendar=TSE_MARKET_CALENDAR,
}={}){
 const blocked=reason=>({...statusBlocked(null,reason),
  stockCount:0,cohortStatus:'NOT_EVALUATED'});
 try{
  pinnedExitFollowupDates({plan,calendar});
  const codes=plan.plannedNextPeriod.codes;
  if(!Array.isArray(items)||items.length!==codes.length)
   fail('REQUIRED_SIX_PREDECLARED_STOCKS');
  const seen=new Set(),verified=[];
  for(const item of items){
   const code=item?.originalArchive?.code;
   if(!codes.includes(code)||seen.has(code))
    fail('UNEXPECTED_OR_DUPLICATE_COHORT_STOCK');
   seen.add(code);
   const evaluation=evaluateFrozenFourPatternExitFollowup({
    ...item,plan,calendar,
   });
   if(evaluation.status!==successful)
    fail('ONE_OR_MORE_UNVERIFIED_TAIL_ARCHIVES');
   verified.push({archive:item.originalArchive,evaluation});
  }
  if(!exact([...seen].sort(),[...codes].sort()))
   fail('REQUIRED_SIX_PREDECLARED_STOCKS');
  const comparison=summarizeVerifiedMultiStockFourPatternEvaluations(verified);
  if(comparison.status!=='MULTI_STOCK_RETROSPECTIVE_SHADOW_ONLY'||
   comparison.stockCount!==6)
   fail('FINAL_COHORT_AGGREGATION_BLOCKED');
  return {version:FOUR_PATTERN_EXIT_FOLLOWUP_VERSION,
   status:'FROZEN_SIX_STOCK_EXIT_TAIL_RECONCILED_SHADOW_ONLY',
   planVersion:plan.version,
   signalWindow:plan.plannedNextPeriod,
   outcomeOnlyFollowupDates:pinnedExitFollowupDates({plan,calendar}),
   calendarVersion:calendar.version,stockCount:6,
   originalSignalMinuteBars:verified.reduce((sum,v)=>
    sum+v.evaluation.originalMinuteBars,0),
   tailOnlyMinuteBars:verified.reduce((sum,v)=>
    sum+v.evaluation.followupMinuteBars,0),
   results:comparison,
   noSignalsFromFollowup:true,
   priceOnly:true,actualAtDecisionTimeMarketDataProven:false,
   prospectiveFreezeOfSignalsProven:false,
   eligibleForNotifications:false,eligibleForProduction:false,
   canTriggerTrade:false,
   limitations:[
    'Tail data is used ONLY as outcome labels, never to discover new entries.',
    'Historical bulk retrieval does not establish that signals were available live.',
    'Three previous stocks plus three additional preselected stocks do not prove a stable positive trading edge.',
    'Result uses hypothetical next-open and close fills and fixed transaction friction.',
   ],
  };
 }catch(error){return blocked(safeReason(error))}
}
