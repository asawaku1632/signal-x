// Offline research-only historical-data audit. No provider download, DB writes,
// prediction reconstruction, accuracy claims, or live AI changes.
export function assessHistoricalResearchDataset(rows) {
  if (!Array.isArray(rows)) throw new TypeError("INVALID_HISTORICAL_DATASET");
  const reasons={};
  const items=rows.map((r,index)=>{
    const issues=[];
    if(!r || typeof r!=="object" || Array.isArray(r)) issues.push("INVALID_ROW");
    else {
      const day=r.observation_date;
      const observed=typeof day==="string" && /^\d{4}-\d{2}-\d{2}$/.test(day)
        ? Date.parse(day+"T00:00:00Z") : NaN;
      const validDay=Number.isFinite(observed) && new Date(observed).toISOString().slice(0,10)===day;
      if(!validDay) issues.push("INVALID_OBSERVATION_DATE");
      // PostgreSQL timestamptz text may use a space and a short +00 offset.
      // Normalize only explicitly offset-bearing timestamps; reject local/naive time.
      const raw=typeof r.created_at==="string" ? r.created_at.trim() : "";
      const normalized=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}$/.test(raw)
        ? raw.replace(" ","T")+":00" : raw;
      const created=/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
        ? Date.parse(normalized) : NaN;
      if(!Number.isFinite(created) || !validDay)
        issues.push("MISSING_OBSERVATION_OR_STORAGE_TIME");
      else {
        // Japanese observation day spans [previous UTC 15:00, current UTC 15:00).
        if(created < observed - 9*60*60*1000)
          issues.push("SAVED_BEFORE_OBSERVATION_DAY");
        if(created >= observed + 15*60*60*1000)
          issues.push("SAVED_AFTER_OBSERVATION_DAY");
      }
      if(typeof r.provider!=="string" || !r.provider.trim())
        issues.push("MISSING_SOURCE");
      if(r.license_review_verified!==true || !r.license_evidence_reference)
        issues.push("UNVERIFIED_RESEARCH_LICENSE");
      if(r.independent_prediction_timestamp_verified!==true)
        issues.push("NO_VERIFIED_ASOF_PREDICTION");
    }
    for(const issue of issues) reasons[issue]=(reasons[issue]??0)+1;
    return {index,classification:"RETROSPECTIVE_REFERENCE_ONLY",issues};
  });
  return {status:"HISTORICAL_AUDIT_ONLY",reviewed:rows.length,issues:reasons,items,
    verified_forward_predictions:0,eligible_for_ai_power_training:false,
    production_write_authorized:false};
}
