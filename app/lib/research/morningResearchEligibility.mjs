/** Read-only classification of research evidence; never grants trading approval. */
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
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
    return {kind:"FIVE_MINUTE_MORNING_EXPORT",
      dailyIndicatorCandidate:false,morningOutcomeCandidate:reasons.length===0,
      reasons,requiresIndependentSourceProof:true,requiresFeatureAvailabilityProof:true,
      readyForTrading:false};
  }
  return {kind:"UNRECOGNIZED",dailyIndicatorCandidate:false,morningOutcomeCandidate:false,
    reasons:["UNSUPPORTED_TIMEFRAME"],readyForTrading:false};
}
