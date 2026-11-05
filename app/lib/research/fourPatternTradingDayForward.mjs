/**
 * SHADOW ONLY. 1/3/5 TSE TRADING-DAY retrospective outcome protocol, distinct
 * from the four-pattern engine's existing 1/3/5 CLOSED INTRADAY BAR outcomes.
 * Requires a contiguous calendar-covered series of fully reconciled original
 * J-Quants minute/daily sessions. No API, credentials, DB, alerts or orders.
 */
import {
  reconcileCapturedTradeDay,aggregateReconciledMinutes,
  studyCapturedJQuantsFourPatterns,
} from './fourPatternJQuantsBridge.mjs';
import {FOUR_PATTERN_IDS,FOUR_PATTERN_RULES} from './fourStrategyShadow.mjs';
import {
  TSE_MARKET_CALENDAR,resolveTseTradingDatesAfter,isTseTradingDate,
} from '../technicalObservation/tseMarketCalendar.ts';

export const FOUR_PATTERN_TRADING_DAY_VERSION='four_pattern_trading_day_outcome_shadow_v1';
export const DAY_HORIZONS=Object.freeze([1,3,5]);
const round=(x,n=3)=>Number(x.toFixed(n));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const median=a=>{
 const sorted=[...a].sort((x,y)=>x-y);
 const m=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;
};
const fail=reason=>{throw new TypeError(reason)};
const okDay=d=>typeof d==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(d)&&
 Number.isFinite(Date.parse(d+'T00:00:00Z'))&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;

export function assertContinuousTseSessions(sessions,{calendar=TSE_MARKET_CALENDAR}={}){
 if(!Array.isArray(sessions)||sessions.length<1||sessions.length>35)
  fail('INVALID_SESSION_COUNT');
 const seen=new Set();
 for(let i=0;i<sessions.length;i++){
  const current=sessions[i];
  if(!okDay(current?.date)||current.dailyMatched!==true ||
     !Array.isArray(current.minutes)||current.minutes.length===0||
     seen.has(current.date))fail('INVALID_OR_DUPLICATE_VERIFIED_SESSION');
  seen.add(current.date);
  try{
   if(!isTseTradingDate(current.date,calendar))
    fail('NONTRADING_DATE_IN_ARCHIVE');
   if(i&&resolveTseTradingDatesAfter(sessions[i-1].date,1,{calendar})[0]!==current.date)
    fail('MISSING_INTERVENING_TRADING_SESSION');
  }catch(error){
   if(error instanceof TypeError)throw error;
   fail('TSE_MARKET_CALENDAR_UNVERIFIED');
  }
 }
 return {calendarVersion:calendar.version,first:sessions[0].date,
  last:sessions.at(-1).date,verifiedSessions:sessions.length,
  contiguousTradingDates:true};
}

export function sessionDailyPrices(verifiedSessions){
 return verifiedSessions.map(s=>{
  if(s?.dailyMatched!==true||!Array.isArray(s.minutes)||!s.minutes.length)
   fail('UNRECONCILED_DAILY_PRICES');
  const ordered=s.minutes;
  const open=ordered[0].open,close=ordered.at(-1).close;
  const low=Math.min(...ordered.map(m=>m.low));
  const high=Math.max(...ordered.map(m=>m.high));
  if(![open,close,low,high].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0)||
   low>Math.min(open,close)||high<Math.max(open,close))
   fail('INVALID_SESSION_DAILY_PRICES');
  return {date:s.date,open,close,low,high};
 });
}

/** The earliest signal of each strategy per TSE day is preselected, not the
 * best eventual entry. Each timeframe is evaluated independently.
 */
export function evaluateTradingDaySignals({report,candles,sessions,calendar=TSE_MARKET_CALENDAR}){
 if(report?.status!=='OFFLINE_SHADOW_ONLY'||!Array.isArray(report.rows))
  return {status:'PATTERN_HISTORY_INSUFFICIENT',summaries:[],signals:[]};
 const calendarAudit=assertContinuousTseSessions(sessions,{calendar});
 const daily=sessionDailyPrices(sessions),byDay=new Map(daily.map((d,i)=>[d.date,i]));
 const byTime=new Map(candles.map(c=>[c.time,c.barDate]));
 if(byTime.size!==candles.length)fail('DUPLICATE_TIMEFRAME_CLOSE');
 const unique=new Map();
 let duplicatesDropped=0;
 for(const signal of report.rows){
  if(!FOUR_PATTERN_IDS.includes(signal?.strategy)||!Number.isSafeInteger(signal.signalTime))
   fail('UNKNOWN_PATTERN_SIGNAL');
  const date=byTime.get(signal.signalTime);
  if(!date||!byDay.has(date))fail('SIGNAL_OUTSIDE_RECONCILED_SESSION');
  const key=signal.strategy+'|'+date;
  if(unique.has(key)){duplicatesDropped++;continue}
  unique.set(key,{strategy:signal.strategy,signalDate:date,signalTime:signal.signalTime});
 }
 const output=[];
 for(const signal of unique.values()){
  const i=byDay.get(signal.signalDate);
  const horizonResults=[];
  for(const horizon of DAY_HORIZONS){
   let dates;
   try{
    dates=resolveTseTradingDatesAfter(signal.signalDate,horizon,{calendar});
   }catch{fail('TSE_MARKET_CALENDAR_UNVERIFIED')}
   const entryDate=dates[0],exitDate=dates.at(-1);
   if(!byDay.has(exitDate)){
    // A verified, contiguous archive may genuinely end before the target
    // trading day. Never substitute the last observed bar for exit.
    if(exitDate<=calendarAudit.last)fail('MISSING_INTERVENING_TRADING_SESSION');
    horizonResults.push({horizonTradingDays:horizon,status:'PENDING',
     entryDate,exitDate,returnPercent:null,profitYen100:null});
    continue;
   }
   const startIndex=byDay.get(entryDate),endIndex=byDay.get(exitDate);
   if(startIndex!==i+1||endIndex!==i+horizon)
    fail('SESSION_INDEX_AND_TSE_CALENDAR_MISMATCH');
   const buy=daily[startIndex].open*(1+FOUR_PATTERN_RULES.perSideFriction);
   const sell=daily[endIndex].close*(1-FOUR_PATTERN_RULES.perSideFriction);
   const budgetEligible=buy*FOUR_PATTERN_RULES.shares<=FOUR_PATTERN_RULES.maxBudgetYen;
   if(!budgetEligible){
    horizonResults.push({horizonTradingDays:horizon,status:'BUDGET_EXCLUDED',
     entryDate,exitDate,returnPercent:null,profitYen100:null});
    continue;
   }
   const lows=daily.slice(startIndex,endIndex+1).map(s=>s.low);
   horizonResults.push({horizonTradingDays:horizon,
    status:'HISTORICAL_HYPOTHETICAL_ONLY',
    entryDate,exitDate,returnPercent:round((sell/buy-1)*100),
    profitYen100:Math.round((sell-buy)*FOUR_PATTERN_RULES.shares),
    worstAdversePercent:round((Math.min(...lows)/buy-1)*100)});
  }
  output.push({...signal,outcomes:horizonResults});
 }
 const summaries=FOUR_PATTERN_IDS.map(strategy=>{
  const selected=output.filter(r=>r.strategy===strategy);
  return {strategy,uniqueSignalDays:selected.length,
   horizons:DAY_HORIZONS.map(h=>{
    const rows=selected.map(s=>s.outcomes.find(o=>o.horizonTradingDays===h));
    const done=rows.filter(o=>o.status==='HISTORICAL_HYPOTHETICAL_ONLY');
    return {tradingDays:h,measured:done.length,
     pending:rows.filter(o=>o.status==='PENDING').length,
     budgetExcluded:rows.filter(o=>o.status==='BUDGET_EXCLUDED').length,
     winRatePercent:done.length?
      round(done.filter(o=>o.profitYen100>0).length/done.length*100,2):null,
     meanReturnPercent:done.length?round(mean(done.map(o=>o.returnPercent))):null,
     medianReturnPercent:done.length?round(median(done.map(o=>o.returnPercent))):null,
     averageProfitYen100:done.length?Math.round(mean(done.map(o=>o.profitYen100))):null,
     worstAdversePercent:done.length?
      round(Math.min(...done.map(o=>o.worstAdversePercent))):null};
   })};
 });
 return {status:'TSE_CALENDAR_VERIFIED_RETROSPECTIVE_ONLY',
  calendarVersion:calendarAudit.calendarVersion,metricsUnit:'TSE_TRADING_DAYS',
  entryMethod:'NEXT_TSE_SESSION_FIRST_EXECUTED_OPEN',
  exitMethod:'TARGET_TSE_SESSION_LAST_EXECUTED_CLOSE',
  originalSignals:report.rows.length,uniqueDateStrategySignals:output.length,
  duplicateSameDayStrategySignalsDiscarded:duplicatesDropped,
  rules:{shares:FOUR_PATTERN_RULES.shares,
   perSideFriction:FOUR_PATTERN_RULES.perSideFriction,
   maxBudgetYen:FOUR_PATTERN_RULES.maxBudgetYen},
  summaries,signals:output,eligibleForNotifications:false,
  eligibleForLiveTrading:false};
}

/** Reuses a licensed private archive without reading any external provider. */
export function evaluateJQuantsFourPatternTradingDays(archive,{timeframe='BOTH',
 calendar=TSE_MARKET_CALENDAR}={}){
 const code=archive?.code??null;
 const blocked=reason=>({version:FOUR_PATTERN_TRADING_DAY_VERSION,code,
  status:'BLOCKED_'+reason,results:[],eligibleForNotifications:false,
  eligibleForProduction:false});
 try{
  if(!['BOTH','30m','60m'].includes(timeframe))fail('INVALID_TIMEFRAME');
  const base=studyCapturedJQuantsFourPatterns({...archive,timeframe});
  if(base.status!=='HISTORICAL_RECONCILED_SHADOW_ONLY')
   fail('UNRECONCILED_OR_INVALID_ARCHIVE');
  const sessions=archive.minuteDays.map((day,i)=>
   reconcileCapturedTradeDay({code,date:day.date,minutePages:day.pages,
    dailyPages:archive.dailyDays[i].pages}));
  const audit=assertContinuousTseSessions(sessions,{calendar});
  const results=base.reports.map(({timeframe:tf,report})=>{
   const candles=aggregateReconciledMinutes(sessions,tf==='30m'?30:60);
   const evaluation=evaluateTradingDaySignals({report,candles,sessions,calendar});
   return {timeframe:tf,intradaySignalCount:report.rows.length,...evaluation};
  });
  return {version:FOUR_PATTERN_TRADING_DAY_VERSION,
   status:'RETROSPECTIVE_TSE_DAY_EVALUATION_SHADOW_ONLY',
   code,originalMinuteBars:base.capturedOriginalMinutes,
   source:'JQUANTS_V2_RECONCILED_CAPTURED_HISTORICAL',
   validatedTradeDates:audit.verifiedSessions,
   continuousCalendarVersion:audit.calendarVersion,
   financialStatus:base.financialStatus,
   results,eligibleForNotifications:false,eligibleForProduction:false,
   actualSignalAvailabilityAtDecisionTimeProven:false,
   forwardProspectiveValidationCompleted:false,
   note:'1/3/5 Japanese TSE trading sessions, not intraday bars. Same-stock outcomes across timeframes may overlap; sample size is not independent. Net hypothetical 100 shares, 0.1% friction each side, no execution guarantee.'};
 }catch(error){
  const reason=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?
   error.message:'UNVERIFIED_ARCHIVE';
  return blocked(reason);
 }
}
