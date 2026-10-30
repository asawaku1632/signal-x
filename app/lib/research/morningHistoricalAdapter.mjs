/** Offline adapter for already retrieved historical bars; NO network, DB or side effects. */
import {inspectMorning,summarizeMorningDropPatterns} from "./morningAnalog.mjs";
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const codePattern=/^(?:\d{4}|\d{3}[A-Z])$/;
const jstParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const parts=t=>Object.fromEntries(jstParts.formatToParts(new Date(t*1000)).map(p=>[p.type,p.value]));
/** Bar timestamp MUST denote start of bar in Unix seconds. */
export function adaptHistoricalMorning(input){
  const {code,tradeDate,previousClose,intervalMinutes=5,bars,source,licenseVerified=false,
    timestampSemantics,exchangeTimezone}=input??{};
  if(!codePattern.test(code??"")||!datePattern.test(tradeDate??"")||
     !Array.isArray(bars)||typeof source!=="string"||!source.trim()||licenseVerified!==true||
     timestampSemantics!=="BAR_START"||exchangeTimezone!=="Asia/Tokyo")
    return {valid:false,reason:"UNVERIFIED_SOURCE_OR_METADATA"};
  // A complete intraday outcome must not be reconstructed from daily
  // indicator snapshots or another bar interval.
  if(intervalMinutes!==5||input?.timeframe==="1D"||input?.timeframe==="DAILY")
    return {valid:false,reason:"NOT_FIVE_MINUTE_INTRADAY_BARS"};
  const converted=[];
  for(const b of bars){
    if(!Number.isSafeInteger(b?.time)||b.time<=0)return {valid:false,reason:"INVALID_TIMESTAMP"};
    // Valid Unix seconds can still exceed JavaScript Date's representable range.
    if(!Number.isFinite(b.time*1000)||!Number.isFinite(new Date(b.time*1000).getTime()))
      return {valid:false,reason:"INVALID_TIMESTAMP"};
    const p=parts(b.time);
    const date=`${p.year}-${p.month}-${p.day}`;
    converted.push({date,time:`${p.hour}:${p.minute}`,
      open:b.open,high:b.high,low:b.low,close:b.close});
  }
  const result=inspectMorning(tradeDate,previousClose,converted,{intervalMinutes});
  return result.valid?{...result,code,source}:{...result,code};
}
export function aggregateHistoricalMorning(inputs,options={}){
  if(!Array.isArray(inputs))throw Error("INVALID_HISTORICAL_INPUT");
  const adapted=inputs.map(adaptHistoricalMorning);
  const rejectedByReason={};
  for(const row of adapted){
    if(row.valid===true)continue;
    const reason=typeof row.reason==="string"?row.reason:"UNKNOWN";
    rejectedByReason[reason]=(rejectedByReason[reason]??0)+1;
  }
  const patterns=summarizeMorningDropPatterns(adapted,options);
  const validRows=adapted.filter(row=>row.valid===true);
  const cohortKeys=new Set(validRows.map(row=>row.code+"|"+row.date));
  // Only sharp-drop cohort keys without conflicting duplicate observations count.
  // Their number must agree with the pattern summary; do not infer membership
  // from full OHLC coverage alone.
  const byKey=new Map();
  for(const row of validRows){
    const key=row.code+"|"+row.date;
    const group=byKey.get(key)??[];
    group.push(row);
    byKey.set(key,group);
  }
  const eligibleKeys=[];
  let conflictingCompleteStockDays=0;
  const identity=row=>JSON.stringify([
    row.bottomWindow,row.bottomPrice,row.bottomDropPct,row.earlyDropPct,
    row.intervalMinutes,row.laterHigh,row.reboundPct,row.rebound1pct,row.rebound2pct
  ]);
  const threshold=options.dropThresholdPct??3;
  for(const [key,group] of byKey){
    if(group.some(row=>identity(row)!==identity(group[0]))){
      conflictingCompleteStockDays++;
      continue;
    }
    if(group[0].earlyDropPct<=-threshold)eligibleKeys.push(key);
  }
  const eligibleCodes=eligibleKeys.map(key=>key.split("|")[0]);
  const eligibleDates=eligibleKeys.map(key=>key.split("|")[1]);
  return {...patterns,sourceCoverage:{
    completeUniqueStockDays:cohortKeys.size,
    conflictingCompleteStockDays,
    conflictFreeCompleteStockDays:cohortKeys.size-conflictingCompleteStockDays,
    completeDistinctStocks:new Set(validRows.map(row=>row.code)).size,
    completeDistinctTradingDates:new Set(validRows.map(row=>row.date)).size,
    completeDistinctMonths:new Set(validRows.map(row=>row.date.slice(0,7))).size,
    received:inputs.length,structurallyValid:adapted.filter(row=>row.valid===true).length,
    rejected:adapted.filter(row=>row.valid!==true).length,rejectedByReason,
    patternEligibleStockDays:patterns.samples,
    completeButNotPatternEligibleStockDays:cohortKeys.size-conflictingCompleteStockDays-patterns.samples,
    patternDistinctStocks:new Set(eligibleCodes).size,
    patternDistinctTradingDates:new Set(eligibleDates).size,
    patternDistinctMonths:new Set(eligibleDates.map(date=>date.slice(0,7))).size,
    patternExcludedAfterAdapter:patterns.excluded,
    // Complete bars alone do not mean the stock-day satisfied the opening-drop cohort.
    readyForLiveUse:false,
    independentlyAuthenticated:false,
    note:"Source and license flags are supplied by the caller, not independently verified here."
  }};
}
