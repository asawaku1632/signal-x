import {adaptHistoricalMorning} from "./morningHistoricalAdapter.mjs";
/** Read-only classification of research evidence; never grants trading approval. */
const validTime=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
export function classifyMorningResearchEvidence(record){
  if(!record||typeof record!=="object"||Array.isArray(record))
    return {kind:"UNRECOGNIZED",dailyIndicatorCandidate:false,morningOutcomeCandidate:false,
      reasons:["INVALID_RECORD"],readyForTrading:false};
  const timeframe=record.timeframe??(record.intervalMinutes===5?"5m":null);
  const daily=timeframe==="1D"||timeframe==="DAILY";
  const fiveMinute=timeframe==="5m"||timeframe==="5M"||timeframe==="5min";
  const reasons=[];
  if(daily){
    if(!(typeof record.close==="number"&&Number.isFinite(record.close)&&record.close>0))
      reasons.push("MISSING_POSITIVE_CLOSE");
    if(!validTime(record.bar_end_at??record.barEndAt))
      reasons.push("MISSING_BAR_END_TIME");
    if(!/^(?:\\d{4}|\\d{3}[A-Z])$/.test(record.code??""))
      reasons.push("MISSING_STOCK_CODE");
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(record.observation_date??record.tradeDate??""))
      reasons.push("MISSING_OBSERVATION_DATE");
    const observationDate=record.observation_date??record.tradeDate;
    const end=record.bar_end_at??record.barEndAt;
    if(validTime(end)&&/^\d{4}-\d{2}-\d{2}$/.test(observationDate??"")){
      const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",
        year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(end));
      const fields=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      const jstDate=fields.year+"-"+fields.month+"-"+fields.day;
      if(jstDate!==observationDate)reasons.push("BAR_END_DATE_MISMATCH");
    }
    return {kind:"DAILY_TECHNICAL_SNAPSHOT",
      dailyIndicatorCandidate:reasons.length===0,morningOutcomeCandidate:false,
      reasons,requiresIndependentSourceProof:true,requiresFeatureAvailabilityProof:true,
      readyForTrading:false};
  }
  if(fiveMinute){
    if(!Array.isArray(record.bars)||record.bars.length!==30)
      reasons.push("MISSING_COMPLETE_MORNING_BARS");
    if(record.timestampSemantics!=="BAR_START"||record.exchangeTimezone!=="Asia/Tokyo")
      reasons.push("MISSING_BAR_TIME_SEMANTICS");
    if(record.licenseVerified!==true||!record.source)
      reasons.push("MISSING_SOURCE_ASSERTION");
    if(reasons.length===0){
      const adapted=adaptHistoricalMorning({...record,intervalMinutes:5});
      if(!adapted.valid)reasons.push(adapted.reason??"INVALID_MORNING_BARS");
    }
    return {kind:"FIVE_MINUTE_MORNING_EXPORT",
      dailyIndicatorCandidate:false,morningOutcomeCandidate:reasons.length===0,
      reasons,requiresIndependentSourceProof:true,requiresFeatureAvailabilityProof:true,
      readyForTrading:false};
  }
  return {kind:"UNRECOGNIZED",dailyIndicatorCandidate:false,morningOutcomeCandidate:false,
    reasons:["UNSUPPORTED_TIMEFRAME"],readyForTrading:false};
}
