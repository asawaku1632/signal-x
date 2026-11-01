/** Audit time-of-knowledge for saved minute summaries, never reconstruct nonexistent bars. */
export function auditMa75DecisionEvidence(observations){
 if(!Array.isArray(observations))throw Error('INVALID_OBSERVATIONS');
 return {status:'MA75_ASOF_EVIDENCE_GAP_AUDIT_ONLY',
  rows:observations.map(r=>{
   if(typeof r?.date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(r.date))throw Error('INVALID_DATE');
   const p=r.post905;
   const hasSummary=r.minuteStatus==='HISTORICAL_METRICS_ONLY'&&
    Number.isFinite(p?.referenceClose)&&p.referenceClose>0;
   return {date:r.date,
    prior75Sma:r.prior75Sma??null,
    ma75DistancePercent:r.distancePercent??null,
    ma75DistanceUsesSameDayClose:true,
    reference905Close:hasSummary?p.referenceClose:null,
    reference905IsHistoricalOnly:true,
    morningHigh:hasSummary?p.morningHighestHigh:null,
    morningLow:hasSummary?p.morningLowestLow:null,
    morningHighLowKnownBy905:false,
    morningHighLowKnownAfter1000:hasSummary,
    lowTime:null,lowToSubsequentHighPercent:null,
    rawMinuteBarsPresentInSummary:false,
    usableAsVerified905Signal:false};
  }),
  timeOfKnowledgeLeakageBlocked:true,rawMinuteBarsVerified:false,
  independentProviderCaptureAt905Verified:false,
  eligibleForNotifications:false,eligibleForProduction:false};
}
