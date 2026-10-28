// Research-only evidence checks. Never authorizes a production decision.
const dateOK = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+"T00:00:00Z")) && new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const finite = (v) => typeof v === "number" && Number.isFinite(v);
export function auditStoredObservation(row) {
  const issues = [];
  if (!row || typeof row !== "object" || Array.isArray(row)) return {status:"BLOCKED",issues:["INVALID_ROW"]};
  if (!dateOK(row.trade_date)) issues.push("INVALID_TRADE_DATE");
  if (typeof row.code !== "string" || !/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(row.code)) issues.push("INVALID_CODE");
  if (!finite(row.entry_price) || row.entry_price <= 0) issues.push("INVALID_ENTRY_PRICE");
  if (!finite(row.ai_power) || row.ai_power < 0 || row.ai_power > 100) issues.push("INVALID_AI_POWER");
  if (typeof row.captured_at !== "string" || !Number.isFinite(Date.parse(row.captured_at)) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(row.captured_at)) issues.push("INVALID_CAPTURE_TIMESTAMP");
  if (row.return_5d === null || row.return_5d === undefined) issues.push("MISSING_FIVE_DAY_RETURN");
  else if (!finite(row.return_5d)) issues.push("INVALID_FIVE_DAY_RETURN");
  if (!dateOK(row.outcome_5d_date)) issues.push("INVALID_FIVE_DAY_DATE");
  else if (dateOK(row.trade_date) && row.outcome_5d_date <= row.trade_date) issues.push("FIVE_DAY_NOT_FUTURE");
  if (!row.provider_id || typeof row.provider_id !== "string") issues.push("MISSING_PROVIDER_PROOF");
  if (row.license_verified !== true) issues.push("UNVERIFIED_LICENSE");
  if (!row.source_digest || typeof row.source_digest !== "string") issues.push("MISSING_SOURCE_DIGEST");
  if (!row.signal_generated_at || !Number.isFinite(Date.parse(row.signal_generated_at))) issues.push("MISSING_SIGNAL_TIME");
  if (!row.bar_end_at || !Number.isFinite(Date.parse(row.bar_end_at))) issues.push("MISSING_BAR_END_TIME");
  if (typeof row.signal_generated_at === "string" && Number.isFinite(Date.parse(row.signal_generated_at)) && typeof row.bar_end_at === "string" && Number.isFinite(Date.parse(row.bar_end_at)) && Date.parse(row.signal_generated_at) < Date.parse(row.bar_end_at)) issues.push("LOOKAHEAD_BAR");
  if (!row.baseline_record_id) issues.push("MISSING_BASELINE_PAIR");
  if (!row.shadow_record_id) issues.push("MISSING_SHADOW_PAIR");
  if (!row.regime_provenance_id) issues.push("MISSING_REGIME_PROVENANCE");
  // Actual independent source attestation, out-of-sample proof and human sign-off
  // are outside this input. This layer is intentionally never an approval gate.
  issues.push("INDEPENDENT_ATTESTATION_REQUIRED");
  return {status:"BLOCKED",issues:[...new Set(issues)]};
}
export function auditStoredBatch(rows, limit=1000) {
  if (!Array.isArray(rows)) return {status:"BLOCKED",checked:0,truncated:false,reasons:{INVALID_BATCH:1}};
  const n=Number.isSafeInteger(limit)&&limit>0?Math.min(limit,1000):1000;
  const seen=new Set(), reasons={};
  for(const row of rows.slice(0,n)){
    const check=auditStoredObservation(row);
    for(const issue of check.issues) reasons[issue]=(reasons[issue]||0)+1;
    if(row && typeof row==="object"){
      const key=String(row.trade_date)+"|"+String(row.code);
      if(seen.has(key)) reasons.DUPLICATE_OBSERVATION=(reasons.DUPLICATE_OBSERVATION||0)+1;
      seen.add(key);
    }
  }
  return {status:"BLOCKED",checked:Math.min(rows.length,n),truncated:rows.length>n,reasons};
}
