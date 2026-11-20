/**
 * Strict offline market-regime alignment for BB_CANDLE_V1 shadow observations.
 * A regime for trade date D is computed only with a benchmark's COMPLETED
 * closes strictly BEFORE D, including a close five trading sessions before
 * the latest known close. No lookahead, fetches, storage or trading actions.
 */
import { isTseTradingDate, resolveTseTradingDatesAfter } from "../technicalObservation/tseMarketCalendar.ts";

export const BB_MARKET_REGIME_VERSION="BB_MARKET_PRIOR_5D_V1";
export const BB_MARKET_REGIMES=Object.freeze(["UP","DOWN","SIDEWAYS","UNKNOWN"]);
const dateValid=x=>typeof x==="string" && /^20\d{2}-\d{2}-\d{2}$/.test(x) &&
  Number.isFinite(Date.parse(x+"T00:00:00Z")) &&
  new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const positive=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
const isSame=(a,b)=>a===b;
export function validateBenchmarkCloses(closes){
  if(!Array.isArray(closes)||closes.length<7||closes.length>2000)
    throw Error("INVALID_BENCHMARK_SAMPLE_COUNT");
  const result=[];
  for(let i=0;i<closes.length;i++){
    const v=closes[i];
    if(!dateValid(v?.date)||!positive(v?.close)||!isTseTradingDate(v.date)||
       (i>0&&v.date<=closes[i-1].date))throw Error("INVALID_BENCHMARK_CLOSE");
    if(i>0&&!isSame(resolveTseTradingDatesAfter(closes[i-1].date,1)[0],v.date))
      throw Error("MISSING_BENCHMARK_TRADING_DAY");
    result.push({date:v.date,close:v.close});
  }
  return result;
}
export function priorMarketRegime(tradeDate,validatedCloses,{thresholdPct=1}={}){
  if(!dateValid(tradeDate)||!isTseTradingDate(tradeDate)||
     !Array.isArray(validatedCloses)||
     !positive(thresholdPct)||thresholdPct>10)throw Error("INVALID_REGIME_REQUEST");
  const prior=validatedCloses.filter(x=>x.date<tradeDate);
  const last=prior.at(-1);
  if(!last||resolveTseTradingDatesAfter(last.date,1)[0]!==tradeDate||prior.length<6)
    return {regime:"UNKNOWN",prior5dPct:null,asOfDate:null,reason:"NO_RECENT_COMPLETE_BENCHMARK"};
  const first=prior.at(-6);
  const change=100*(last.close/first.close-1);
  return {regime:change>=thresholdPct?"UP":change<=-thresholdPct?"DOWN":"SIDEWAYS",
    prior5dPct:Number(change.toFixed(4)),asOfDate:last.date,reason:"PRIOR_COMPLETED_5_TRADING_SESSIONS"};
}
export function compareBuyEventsByMarketRegime(events,benchmarkCloses,{minIndependent=30}={}){
  if(!Array.isArray(events)||!Number.isInteger(minIndependent)||minIndependent<30)
    throw Error("INVALID_REGIME_COMPARISON");
  const validated=validateBenchmarkCloses(benchmarkCloses);
  const assigned=events.map(e=>{
    if(!dateValid(e?.date)||typeof e?.code!=="string"||
       !positive(Math.abs(e?.intradayNetPct??NaN)) && e?.intradayNetPct!==0)
      throw Error("INVALID_EVENT_FOR_MARKET_COMPARISON");
    return {...e,market:priorMarketRegime(e.date,validated)};
  });
  const output={};
  for(const regime of BB_MARKET_REGIMES){
    const rows=assigned.filter(x=>x.market.regime===regime);
    const mature5=rows.filter(x=>typeof x.after5dPct==="number"&&Number.isFinite(x.after5dPct));
    const uniqueDays=new Set(mature5.map(x=>x.date)).size;
    const uniqueStocks=new Set(mature5.map(x=>x.code)).size;
    const eligible=mature5.length>=minIndependent && uniqueDays>=15 && uniqueStocks>=10;
    output[regime]={signals:rows.length,mature5:mature5.length,distinctDays5:uniqueDays,
      distinctStocks5:uniqueStocks,average5dPct:eligible?mature5.reduce((s,e)=>s+e.after5dPct,0)/mature5.length:null,
      positive5dPct:eligible?100*mature5.filter(e=>e.after5dPct>0).length/mature5.length:null,
      evidence:eligible?"EXPLORATORY_RETROSPECTIVE_ONLY":"INSUFFICIENT_DIVERSE_EVIDENCE"};
  }
  return {version:BB_MARKET_REGIME_VERSION,
    basis:"EXTERNALLY_SUPPLIED_TSE_DAILY_BENCHMARK_CLOSES_AS_OF_PRIOR_DAY",
    rows:assigned.map(e=>({code:e.code,date:e.date,slot:e.slot,patterns:e.patterns,
      marketRegime:e.market.regime,marketPrior5dPct:e.market.prior5dPct,
      marketAsOfDate:e.market.asOfDate,after5dPct:e.after5dPct,
      intradayWorstDipPct:e.intradayWorstDipPct})),
    summary:output,eligibleForProduction:false,eligibleForNotifications:false,
    forwardValidated:false};
}
