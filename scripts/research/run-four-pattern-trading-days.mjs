#!/usr/bin/env node
/**
 * Offline retrospective 1/3/5 TSE trading-session review.
 * Reads only the already captured, untracked private local JSON. No network.
 * Never prints licensed raw minute/daily/financial data.
 */
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateJQuantsFourPatternTradingDays}
 from '../../app/lib/research/fourPatternTradingDayForward.mjs';

export function summarizeFourPatternTradingDays(archive,timeframe='BOTH'){
 const result=evaluateJQuantsFourPatternTradingDays(archive,{timeframe});
 if(result.status!=='RETROSPECTIVE_TSE_DAY_EVALUATION_SHADOW_ONLY')
  return {status:result.status,code:result.code,
   eligibleForProduction:false,eligibleForNotifications:false};
 return {status:result.status,code:result.code,
  tradingCalendarVersion:result.continuousCalendarVersion,
  verifiedConsecutiveTradingDates:result.validatedTradeDates,
  originalMinuteRows:result.originalMinuteBars,
  financialStatus:result.financialStatus,
  horizonUnit:'TSE_TRADING_DAYS_NOT_INTRADAY_BARS',
  buy:'NEXT_TRADING_DAY_OPEN',sell:'DAY_1_3_OR_5_CLOSE',
  frictionPerSidePercent:0.1,hypotheticalShares:100,
  priceOnlyShadow:true,canTriggerTrade:false,canTriggerNotification:false,
  forwardProspectiveValidated:false,
  results:result.results.map(({timeframe:tf,status,intradaySignalCount,
   originalSignals,uniqueDateStrategySignals,duplicateSameDayStrategySignalsDiscarded,
   summaries})=>({
    timeframe:tf,status,originalSignals:intradaySignalCount,
    uniqueDateStrategySignals:uniqueDateStrategySignals??0,
    duplicateSameDayStrategySignalsDiscarded:duplicateSameDayStrategySignalsDiscarded??0,
    summaries:summaries.map(({strategy,uniqueSignalDays,horizons})=>({
     strategy,uniqueSignalDays,
     horizons:horizons.map(h=>({
      tradingDays:h.tradingDays,measured:h.measured,pending:h.pending,
      budgetExcluded:h.budgetExcluded,winRatePercent:h.winRatePercent,
      meanReturnPercent:h.meanReturnPercent,
      medianReturnPercent:h.medianReturnPercent,
      averageProfitYen100:h.averageProfitYen100,
      worstAdversePercent:h.worstAdversePercent,
     })),
    })),
   })),
  warnings:[
   'One selected stock and 20 trading dates cannot establish an edge or a reliable win rate.',
   '30m and 60m signal events for the same stock may refer to the same move.',
   'Historical J-Quants minute data was retrieved after each decision date, so actual contemporaneous tradability is not proven.',
   'The result is hypothetical and never authorizes alerts or trade orders.',
  ],
 };
}
export function runFourPatternTradingDaysLocal(argv){
 const [path,option]=argv;
 if(!path||argv.length>2||(option&&
    !['--timeframe=30m','--timeframe=60m','--timeframe=BOTH'].includes(option)))
  throw Error('USAGE_PRIVATE_ARCHIVE_PATH_OPTIONAL_TIMEFRAME');
 if(statSync(path).size>8_000_000)throw Error('ARCHIVE_TOO_LARGE');
 const archive=JSON.parse(readFileSync(path,'utf8'));
 if(!archive||typeof archive!=='object'||Array.isArray(archive))
  throw Error('INVALID_ARCHIVE');
 return summarizeFourPatternTradingDays(archive,option?.split('=')[1]??'BOTH');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const output=runFourPatternTradingDaysLocal(process.argv.slice(2));
  console.log(JSON.stringify(output,null,2));
  if(output.status!=='RETROSPECTIVE_TSE_DAY_EVALUATION_SHADOW_ONLY')
   process.exitCode=1;
 }catch(error){
  const code=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?
   error.message:'UNVERIFIED_OR_INACCESSIBLE_ARCHIVE';
  console.error('FOUR_PATTERN_TRADING_DAYS_BLOCKED',code);
  process.exitCode=1;
 }
}
