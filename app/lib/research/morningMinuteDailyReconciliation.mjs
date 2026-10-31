/**
 * SHADOW-ONLY: reconcile one *already parsed* historical J-Quants minute
 * stock-day against the same-code, same-day UNADJUSTED daily-bar audit.
 * No HTTP, tokens, storage, schedule, trading, scoring or notifications.
 *
 * Matching minute-derived daily OHLCV and daily bars is a necessary
 * quality check, NOT verification of exchange origin or true 09:05 access.
 */
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {MORNING_MINUTE_SHADOW_VERSION} from './morningMinuteShadow.mjs';
import {MA75_JQUANTS_PAGE_VERSION} from './ma75JQuantsDailyPages.mjs';

export const MORNING_MINUTE_DAILY_RECONCILIATION_VERSION='morning_minute_daily_reconciliation_v2';
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const verifiedTimestamp=s=>typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)?
 Date.parse(s):NaN;
const sourceCapturedAfterDate=(source,date)=>{
 const first=verifiedTimestamp(source?.firstReceivedAt);
 const last=verifiedTimestamp(source?.lastReceivedAt);
 // Provider usually publishes historical bars ~16:30 JST. This is a
 // conservative scheduling guard, NOT a signed provider publication time.
 const earliest=Date.parse(date+'T07:30:00Z');
 return Number.isFinite(first)&&Number.isFinite(last)&&
   first>=earliest&&last>=first;
};
const reportedRowCountsMatch=daily=>{
 if(!daily?.counts||typeof daily.counts!=='object'||
    Array.isArray(daily.counts)||!Array.isArray(daily.rows)||
    !Number.isSafeInteger(daily.rawProviderRows)||
    !Number.isSafeInteger(daily.readPages)||daily.readPages<1||
    daily.rawProviderRows<0)return false;
 const counts={};
 for(const row of daily.rows){
   if(typeof row?.status!=='string')return false;
   counts[row.status]=(counts[row.status]??0)+1;
 }
 return Object.keys(counts).length===Object.keys(daily.counts).length&&
    Object.entries(counts).every(([name,n])=>daily.counts[name]===n)&&
    daily.structurallyUsableRawBars===(counts.DAILY_BAR??0);
};
const same=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));

export function reconcileMorningMinuteDaily(freeze,{code,date,minute,daily}={}){
 validateMa75FrozenUniverse(freeze);
 if(typeof code!=='string'||!freeze.codes.includes(code)||
    typeof date!=='string'||!/^20\d\d-\d\d-\d\d$/.test(date))
  throw new TypeError('Need one frozen code and exact trade date');
 const reasons=[];
 if(!minute||minute.version!==MORNING_MINUTE_SHADOW_VERSION||
    minute.code!==code||minute.date!==date||
    minute.structuralPass!==true||minute.pageChainComplete!==true||
    !Array.isArray(minute.errors)||minute.errors.length!==0||
    minute.originalFrozenCohortSize!==freeze.codes.length||
    !sourceCapturedAfterDate(minute,date)||
    !Number.isSafeInteger(minute.observedRawBars)||minute.observedRawBars<0)
  reasons.push('INVALID_OR_DIFFERENT_MINUTE_AUDIT');
 if(!daily||daily.version!==MA75_JQUANTS_PAGE_VERSION||
    daily.date!==date||daily.paginationComplete!==true||
    daily.expectedFrozenCodes!==freeze.codes.length||
    !Array.isArray(daily.failures)||daily.failures.length!==0||
    !Array.isArray(daily.rows)||daily.rows.length!==freeze.codes.length||
    daily.rows.some((r,i)=>r?.code!==freeze.codes[i]||r.tradeDate!==date)||
    !sourceCapturedAfterDate(daily,date)||
    !reportedRowCountsMatch(daily)||
    !Array.isArray(daily.unmappedRows)||daily.unmappedRows.length!==0||
    !Array.isArray(daily.duplicateCodeDates)||daily.duplicateCodeDates.length!==0||
    !Array.isArray(daily.outsideFrozenCodes)||daily.outsideFrozenCodes.length!==0)
  reasons.push('INVALID_OR_DIFFERENT_DAILY_AUDIT');
 const row=Array.isArray(daily?.rows)?daily.rows.find(r=>r.code===code):null;
 const aggregate=minute?.dailyObservation;
 if(!aggregate||aggregate.code!==code||aggregate.date!==date||
    aggregate.unadjusted!==true||!Number.isInteger(aggregate.barCount)||
    aggregate.barCount<0||aggregate.barCount>327||
    minute?.observedRawBars!==aggregate.barCount||
    (aggregate.barCount===0&&(
      aggregate.open!==null||aggregate.high!==null||aggregate.low!==null||
      aggregate.close!==null||aggregate.volume!==0||aggregate.turnover!==0))||
    (aggregate.barCount>0&&(
      ![aggregate.open,aggregate.high,aggregate.low,aggregate.close].every(positive)||
      aggregate.high<Math.max(aggregate.open,aggregate.close,aggregate.low)||
      aggregate.low>Math.min(aggregate.open,aggregate.close,aggregate.high)))||
    !positive(aggregate.volume)&&aggregate.barCount>0||
    !positive(aggregate.turnover)&&aggregate.barCount>0)
   reasons.push('INVALID_MINUTE_DAY_AGGREGATE');
 const noTrades=aggregate?.barCount===0;
 if(row?.status==='CORPORATE_ACTION_REVIEW')
   reasons.push('CORPORATE_ACTION_UNRESOLVED');
 else if(row?.status==='NO_TRADE'){
   if(!noTrades)reasons.push('DAILY_NO_TRADE_BUT_MINUTE_TRADES_FOUND');
 }else if(row?.status==='DAILY_BAR'){
   if(noTrades)reasons.push('DAILY_TRADES_BUT_NO_MINUTE_BARS');
   const dailyBar=row.bar;
   if(dailyBar?.unadjusted!==true||dailyBar.code!==code||dailyBar.tradeDate!==date||
      ![dailyBar.open,dailyBar.high,dailyBar.low,dailyBar.close,dailyBar.volume].every(positive)||
      dailyBar.high<Math.max(dailyBar.open,dailyBar.close,dailyBar.low)||
      dailyBar.low>Math.min(dailyBar.open,dailyBar.close,dailyBar.high))
     reasons.push('INVALID_UNADJUSTED_DAILY_BAR');
   else if(aggregate?.barCount>0){
     for(const field of ['open','high','low','close','volume']){
       // Share volume is an integer count: even one missing share matters.
       // Price floats may have harmless provider serialization rounding.
       const equal=field==='volume'?
         Object.is(aggregate[field],dailyBar[field]):
         same(aggregate[field],dailyBar[field]);
       if(!equal)
         reasons.push('DAILY_MINUTE_'+field.toUpperCase()+'_MISMATCH');
     }
   }
 }else{
   reasons.push('DAILY_STOCK_DAY_NOT_USABLE');
 }
 const blockers=[...new Set(reasons)];
 const matchingNoTrade=blockers.length===0&&row?.status==='NO_TRADE';
 const matchedTradingDay=blockers.length===0&&row?.status==='DAILY_BAR'&&!noTrades;
 return {
   version:MORNING_MINUTE_DAILY_RECONCILIATION_VERSION,
   code,date,frozenPopulationSize:freeze.codes.length,
   minuteAuditVersion:minute?.version??null,
   dailyAuditVersion:daily?.version??null,
   minuteBarCount:aggregate?.barCount??null,
   minuteSumVolume:aggregate?.volume??null,
   dailyVolume:row?.status==='DAILY_BAR'?row.bar?.volume??null:null,
   structuralOneCodeDayMatched:matchedTradingDay,
   matchingNoTradeSession:matchingNoTrade,
   blocked:!matchedTradingDay,
   blockers,
   directProviderCaptureAuthenticated:false,
   chartCalendarAndActionsIndependentlyVerified:false,
   actual0905AvailabilityVerified:false,
   validProspectiveBuyObservations:0,
   eligibleForNotifications:false,eligibleForProduction:false,
   warning:'Even matching OHLCV, provider envelope, row counts and receipt times cannot prove official as-of 09:05 capture, order execution or profitability.',
 };
}
