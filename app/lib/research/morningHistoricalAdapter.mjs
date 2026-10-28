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
     !Array.isArray(bars)||!source||licenseVerified!==true||
     timestampSemantics!=="BAR_START"||exchangeTimezone!=="Asia/Tokyo")
    return {valid:false,reason:"UNVERIFIED_SOURCE_OR_METADATA"};
  const converted=[];
  for(const b of bars){
    if(!Number.isInteger(b?.time)||b.time<=0)return {valid:false,reason:"INVALID_TIMESTAMP"};
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
  return summarizeMorningDropPatterns(inputs.map(adaptHistoricalMorning),options);
}
