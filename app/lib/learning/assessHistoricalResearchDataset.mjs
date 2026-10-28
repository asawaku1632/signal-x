// Offline research-only historical-data audit. No provider download, DB writes,
// prediction reconstruction, accuracy claims, or live AI changes.
export function assessHistoricalResearchDataset(rows) {
  if (!Array.isArray(rows)) throw new TypeError("INVALID_HISTORICAL_DATASET");
  const reasons={};
  const items=rows.map((r,index)=>{
    const issues=[];
    if(!r || typeof r!=="object" || Array.isArray(r)) issues.push("INVALID_ROW");
    else {
      if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(r.observation_date ?? ""))
        issues.push("INVALID_OBSERVATION_DATE");
      const created=Date.parse(r.created_at);
      const observed=Date.parse((r.observation_date ?? "")+"T00:00:00Z");
      if(!Number.isFinite(created) || !Number.isFinite(observed))
        issues.push("MISSING_OBSERVATION_OR_STORAGE_TIME");
      else if(created > observed + 24*60*60*1000)
        issues.push("SAVED_AFTER_OBSERVATION_DAY");
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
