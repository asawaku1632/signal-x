/** Conservative audit of original daily saved-score timestamp evidence.
 * DB timestamp WITHOUT TIME ZONE is NOT an independently authenticated instant.
 */
const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const stamp=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
export function auditSavedScoreTiming(rows){
 if(!Array.isArray(rows))throw Error("INVALID_SAVED_SCORE_TIMING_INPUT");
 const counts={rows:rows.length,missingOrInvalid:0,naiveTimestamp:0,sameDate:0,priorCalendarDate:0,laterCalendarDate:0,attestedEarlierInstant:0};
 for(const r of rows){
  if(!r||!date(r.date)||typeof r.createdAt!=="string"||!/^\d{4}-\d{2}-\d{2}/.test(r.createdAt)){counts.missingOrInvalid++;continue;}
  const d=r.createdAt.slice(0,10);
  if(!date(d)){counts.missingOrInvalid++;continue;}
  if(!stamp(r.createdAt)){counts.naiveTimestamp++;}
  if(d===r.date)counts.sameDate++;else if(d<r.date)counts.priorCalendarDate++;else counts.laterCalendarDate++;
  if(stamp(r.createdAt)&&Date.parse(r.createdAt)<Date.parse(r.date+"T00:00:00+09:00")&&r.immutableSnapshotAttested===true&&r.providerVerified===true)
   counts.attestedEarlierInstant++;
 }
 return {version:"SAVED_SCORE_TIMING_EVIDENCE_V1",counts,
  independentlyAuthenticatedByAudit:false,verifiedDecisionTimeCount:0,signalEnabled:false,
  warning:"Timestamps without timezone are not absolute instants; caller attestations are not independently authenticated. Same-date saved scores cannot prove they were known before a morning decision."};
}
