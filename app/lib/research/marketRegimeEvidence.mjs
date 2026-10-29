/** Shadow research only: separate claimed predecision index observations from proven market regimes. */
export function auditMarketRegimeEvidence(rows,{cutoffJst="09:05"}={}){
 if(!Array.isArray(rows)||rows.length>10000||!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(cutoffJst))throw Error("INVALID_REGIME_EVIDENCE");
 const seen=new Set(),counts={total:rows.length,duplicate:0,invalid:0,notAsOf:0,sourceUnverified:0,structurallyPlausible:0};
 const days=[];
 for(const r of rows){
  const d=r?.tradeDate;
  if(typeof d!=="string"||!/^\\d{4}-\\d\\d-\\d\\d$/.test(d)||!Number.isFinite(Date.parse(d+"T00:00:00Z"))||new Date(d+"T00:00:00Z").toISOString().slice(0,10)!==d){counts.invalid++;continue;}
  if(seen.has(d)){counts.duplicate++;days.push({date:d,status:"DUPLICATE_DATE"});continue;}seen.add(d);
  const captured=r?.capturedAt;
  if(typeof captured!=="string"||!/^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(?:\\.\\d+)?(?:Z|[+-]\\d\\d:\\d\\d)$/.test(captured)||!Number.isFinite(Date.parse(captured))||Date.parse(captured)>=Date.parse(d+"T"+cutoffJst+":00+09:00")){counts.notAsOf++;days.push({date:d,status:"NOT_PREDECISION"});continue;}
  if(!Number.isFinite(r.nikkei)||r.nikkei<=0||!Number.isFinite(r.topix)||r.topix<=0){counts.invalid++;days.push({date:d,status:"INVALID_INDEX_VALUES"});continue;}
  counts.structurallyPlausible++;
  counts.sourceUnverified++;
  days.push({date:d,status:"PREDECISION_CLAIM_ONLY"});
 }
 return {counts,days,verifiedRegimeDays:0,readyForPrediction:false,readyForTraining:false,
  warning:"Price level and captured-at time are not independently authenticated; no benchmark prior-close change or verified regime label."};
}
