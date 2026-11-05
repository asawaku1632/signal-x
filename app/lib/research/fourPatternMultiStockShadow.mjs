/**
 * Local, price-only, multi-stock SHADOW cohort audit for four-pattern research.
 * Uses independently reconciled J-Quants archives. No network, DB or trading.
 *
 * Method is frozen: 1/3/5 JPX trading-session horizons, next-session entry
 * open, horizon close, 100 shares, 0.1% each side, 500k yen budget.
 * 30m vs 60m overlapping stock/date/strategy signals are not double counted.
 */
import {evaluateJQuantsFourPatternTradingDays}
 from './fourPatternTradingDayForward.mjs';
import {FOUR_PATTERN_IDS,FOUR_PATTERN_RULES} from './fourStrategyShadow.mjs';

export const FOUR_PATTERN_MULTI_STOCK_VERSION='four_pattern_multi_stock_shadow_v1';
export const MULTI_STOCK_LIMITS=Object.freeze({maxArchives:30,minArchives:1});
export const MULTI_STOCK_HORIZONS=Object.freeze([1,3,5]);
const PRICE_ONLY_STRATEGIES=FOUR_PATTERN_IDS.filter(x=>x!=='QUALITY_PULLBACK');
const goodCode=s=>typeof s==='string'&&/^[0-9]{3}[0-9A-Z]$/.test(s);
const round=(x,p=3)=>Number(x.toFixed(p));
const average=a=>a.reduce((s,v)=>s+v,0)/a.length;
const median=values=>{
 const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);
 return a.length%2?a[m]:(a[m-1]+a[m])/2;
};
const fail=x=>{throw new TypeError(x)};
const RESULT_OK='RETROSPECTIVE_TSE_DAY_EVALUATION_SHADOW_ONLY';
const STUDY_OK='TSE_CALENDAR_VERIFIED_RETROSPECTIVE_ONLY';
const DONE='HISTORICAL_HYPOTHETICAL_ONLY';
const OUTCOMES=new Set([DONE,'PENDING','BUDGET_EXCLUDED']);

function verifiedOutcome(outcome,horizon){
 if(!outcome||outcome.horizonTradingDays!==horizon||
  !OUTCOMES.has(outcome.status)||
  typeof outcome.entryDate!=='string'||typeof outcome.exitDate!=='string')
  fail('INVALID_HORIZON_RESULT');
 if(outcome.status===DONE){
  if(![outcome.returnPercent,outcome.profitYen100,
    outcome.worstAdversePercent].every(Number.isFinite)||
    !Number.isInteger(outcome.profitYen100))
   fail('INVALID_COMPLETED_RETURN');
 }else if(outcome.returnPercent!==null||outcome.profitYen100!==null){
  fail('UNCOMPLETED_WITH_RETURN');
 }
 return outcome;
}
function canonicalOutcomeKey(outcomes){
 return JSON.stringify(outcomes.map(o=>({
  h:o.horizonTradingDays,s:o.status,entry:o.entryDate,exit:o.exitDate,
  r:o.returnPercent,profit:o.profitYen100,adverse:o.worstAdversePercent??null,
 })));
}
function stageCandidates(archive,evaluation){
 if(!goodCode(archive?.code)||evaluation?.code!==archive.code||
  evaluation?.status!==RESULT_OK||evaluation.results?.length!==2)
  fail('INVALID_OR_INCOMPLETE_ARCHIVE_EVALUATION');
 const observed=new Set();
 const candidates=[];
 for(const study of evaluation.results){
  if(!['30m','60m'].includes(study?.timeframe)||
    observed.has(study.timeframe))fail('INVALID_OR_DUPLICATE_TIMEFRAME');
  observed.add(study.timeframe);
  if(study.status==='PATTERN_HISTORY_INSUFFICIENT'){
   if(study.signals?.length)fail('INVALID_UNMEASURED_SIGNALS');
   continue;
  }
  if(study.status!==STUDY_OK||!Array.isArray(study.signals))
   fail('INVALID_PATTERN_STUDY');
  for(const signal of study.signals){
   if(!PRICE_ONLY_STRATEGIES.includes(signal?.strategy)||
      !Number.isSafeInteger(signal.signalTime)||signal.signalTime<=0||
      typeof signal.signalDate!=='string'||
      !Array.isArray(signal.outcomes)||signal.outcomes.length!==3)
    fail('INVALID_OR_UNSUPPORTED_STRATEGY_SIGNAL');
   const outcomes=MULTI_STOCK_HORIZONS.map((h,i)=>
     verifiedOutcome(signal.outcomes[i],h));
   // No financial-driven quality strategy is ever inferred from this cohort.
   candidates.push({code:archive.code,strategy:signal.strategy,
    signalDate:signal.signalDate,signalTime:signal.signalTime,
    timeframe:study.timeframe,outcomes});
  }
 }
 if(observed.size!==2)fail('MISSING_TIMEFRAME_IN_EVALUATION');
 return candidates;
}
function candidateSort(a,b){
 return a.code.localeCompare(b.code)||
  a.signalDate.localeCompare(b.signalDate)||
  a.strategy.localeCompare(b.strategy)||
  a.signalTime-b.signalTime||
  (a.timeframe==='30m'?-1:1);
}
function summaryFor(candidates){
 return MULTI_STOCK_HORIZONS.map(h=>{
  const all=candidates.map(c=>c.outcomes.find(o=>o.horizonTradingDays===h));
  const done=all.filter(o=>o.status===DONE),returns=done.map(o=>o.returnPercent),
   profits=done.map(o=>o.profitYen100);
  const completed=candidates.filter(c=>
   c.outcomes.find(o=>o.horizonTradingDays===h)?.status===DONE);
  return {tradingDays:h,signals:candidates.length,measured:done.length,
   pending:all.filter(x=>x.status==='PENDING').length,
   budgetExcluded:all.filter(x=>x.status==='BUDGET_EXCLUDED').length,
   measuredStockCount:new Set(completed.map(x=>x.code)).size,
   measuredSignalDates:new Set(completed.map(x=>x.signalDate)).size,
   winRatePercent:done.length?
    round(profits.filter(x=>x>0).length/done.length*100,2):null,
   averageReturnPercent:done.length?round(average(returns)):null,
   medianReturnPercent:done.length?round(median(returns)):null,
   averageProfitYen100:done.length?Math.round(average(profits)):null,
   medianProfitYen100:done.length?Math.round(median(profits)):null,
   worstProfitYen100:done.length?Math.min(...profits):null,
   worstAdversePercent:done.length?
    round(Math.min(...done.map(o=>o.worstAdversePercent))):null,
   atLeast7000YenPercent:done.length?
    round(profits.filter(x=>x>=7000).length/done.length*100,2):null,
   atLeast10000YenPercent:done.length?
    round(profits.filter(x=>x>=10000).length/done.length*100,2):null,
   atMostMinus10000YenPercent:done.length?
    round(profits.filter(x=>x<=-10000).length/done.length*100,2):null,
  };
 });
}
/**
 * Evaluate unmodified private capture objects. A cohort must use exactly the
 * same observed sessions for every stock to avoid time-window cherry picking.
 * This function does not pretend local archives have verified live availability.
 */
export function summarizeMultiStockFourPatternArchives(archives){
 const blocked=reason=>({
  version:FOUR_PATTERN_MULTI_STOCK_VERSION,status:'BLOCKED_'+reason,
  eligibleForNotifications:false,eligibleForProduction:false,
  canTriggerTrade:false,byStrategy:[],portfolioByTradingDay:[],
 });
 try{
  if(!Array.isArray(archives)||archives.length<MULTI_STOCK_LIMITS.minArchives||
   archives.length>MULTI_STOCK_LIMITS.maxArchives)
   fail('ARCHIVE_COUNT_OUT_OF_BOUNDS');
  const codes=new Set(),staged=[];
  let referenceDates=null,calendarVersion=null,originalMinuteBars=0;
  for(const archive of archives){
   if(!goodCode(archive?.code)||codes.has(archive.code))
    fail('INVALID_OR_DUPLICATE_STOCK_CODE');
   if(archive.financialPages!==undefined&&archive.financialPages!==null)
    fail('PRICE_ONLY_COHORT_REQUIRES_SKIP_FINANCIAL');
   const result=evaluateJQuantsFourPatternTradingDays(archive,{timeframe:'BOTH'});
   if(result.status!==RESULT_OK)
    fail('ONE_OR_MORE_UNVERIFIED_STOCK_ARCHIVES');
   if(calendarVersion!==null&&calendarVersion!==result.continuousCalendarVersion)
    fail('INCONSISTENT_TSE_CALENDAR_VERSIONS');
   calendarVersion=result.continuousCalendarVersion;
   const dates=result.results?.length===2?archive.minuteDays.map(x=>x.date):null;
   if(!dates||dates.length<1)fail('MISSING_STOCK_DATES');
   if(referenceDates!==null&&JSON.stringify(dates)!==JSON.stringify(referenceDates))
    fail('NONCOMPARABLE_STOCK_DATE_COVERAGE');
   referenceDates=dates;
   codes.add(archive.code);
   originalMinuteBars+=result.originalMinuteBars;
   staged.push(...stageCandidates(archive,result));
  }
  // Cross-timeframe dedup: for the same stock/strategy/date, keep the
  // earliest completed intraday signal; tie-break in favor of 30m.
  staged.sort(candidateSort);
  const perStrategy=new Map();
  let timeframeDuplicatesDropped=0;
  for(const c of staged){
   const key=c.code+'|'+c.signalDate+'|'+c.strategy;
   if(!perStrategy.has(key)){perStrategy.set(key,c);continue}
   if(canonicalOutcomeKey(perStrategy.get(key).outcomes)!==
     canonicalOutcomeKey(c.outcomes))
    fail('CROSS_TIMEFRAME_OUTCOME_DISAGREEMENT');
   timeframeDuplicatesDropped++;
   const previous=perStrategy.get(key);
   if(c.signalTime<previous.signalTime||
      (c.signalTime===previous.signalTime&&c.timeframe==='30m'&&
       previous.timeframe!=='30m'))perStrategy.set(key,c);
  }
  const selected=[...perStrategy.values()].sort(candidateSort);
  // Separate conservative portfolio view: one stock/date can contribute at
  // most one position even when different strategies also flag that date.
  const portfolio=new Map();
  let crossStrategyDuplicatesDropped=0;
  for(const c of selected){
   const key=c.code+'|'+c.signalDate;
   if(!portfolio.has(key)){portfolio.set(key,c);continue}
   crossStrategyDuplicatesDropped++;
   const previous=portfolio.get(key);
   if(c.signalTime<previous.signalTime||
    (c.signalTime===previous.signalTime&&
     FOUR_PATTERN_IDS.indexOf(c.strategy)<FOUR_PATTERN_IDS.indexOf(previous.strategy)))
     portfolio.set(key,c);
  }
  const portfolioSelected=[...portfolio.values()].sort(candidateSort);
  const byStrategy=PRICE_ONLY_STRATEGIES.map(strategy=>{
   const list=selected.filter(x=>x.strategy===strategy);
   return {strategy,uniqueStockDateStrategySignals:list.length,
    selected30m:list.filter(x=>x.timeframe==='30m').length,
    selected60m:list.filter(x=>x.timeframe==='60m').length,
    horizons:summaryFor(list)};
  });
  return {version:FOUR_PATTERN_MULTI_STOCK_VERSION,
   status:codes.size===1?'SINGLE_STOCK_PILOT_SHADOW_ONLY':
    'MULTI_STOCK_RETROSPECTIVE_SHADOW_ONLY',
   priceOnly:true,financialQualityPattern:'NOT_EVALUATED',
   stockCount:codes.size,stockCodes:[...codes].sort(),
   sameCoverageVerified:true,verifiedTradeDaysPerStock:referenceDates.length,
   firstTradeDate:referenceDates[0],lastTradeDate:referenceDates.at(-1),
   calendarVersion,originalMinuteBars,
   horizonUnit:'TSE_TRADING_DAYS',
   entry:'NEXT_TRADING_DAY_OPEN',exit:'DAY_1_3_5_CLOSE',
   rules:{shares:FOUR_PATTERN_RULES.shares,
    perSideFriction:FOUR_PATTERN_RULES.perSideFriction,
    maxBudgetYen:FOUR_PATTERN_RULES.maxBudgetYen},
   rawTimeframeSignalCount:staged.length,
   timeframeDuplicatesDropped,uniqueStockDateStrategySignals:selected.length,
   crossStrategyDuplicatesDropped,uniquePortfolioStockDateSignals:portfolioSelected.length,
   byStrategy,portfolioByTradingDay:summaryFor(portfolioSelected),
   measuredResultsDoNotProveFutureEdge:true,
   historicalAsOfMarketDataWasNotLive:true,
   eligibleForNotifications:false,eligibleForProduction:false,canTriggerTrade:false,
   researchEvidenceStatus:'NOT_VALIDATED_FOR_TRADING',
   warnings:[
    'All archives are retrospective and captured after the decision date, not proof of 09:05 live visibility.',
    'Comparative stock selection may contain survivorship and selection bias; no train/test separation.',
    'By-strategy samples can overlap on the same stock/day; portfolioByTradingDay applies one-per-stock/day.',
    'Close-only hypothetical exits, no stop-order path or execution/slippage assurance.',
    'No strategy may be promoted based on small, in-sample or duplicated outcome counts.',
   ],
  };
 }catch(error){
  const reason=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?
   error.message:'INVALID_COHORT';
  return blocked(reason);
 }
}
