// Offline, read-only eligibility ledger. Claims alone are never proof of license
// or independent timestamp lineage. This report does not promote research.
export function classifyResearchEvidence(records) {
  if (!Array.isArray(records)) throw new TypeError("INVALID_EVIDENCE_RECORDS");
  const reasons = {};
  const entries = records.map((record,index) => {
    const issues = [];
    if (!record || typeof record !== "object" || Array.isArray(record))
      issues.push("INVALID_RECORD");
    else {
      if (record.provider_permission_reviewed !== true ||
          typeof record.permission_reference !== "string" ||
          !record.permission_reference.trim()) issues.push("PROVIDER_PERMISSION_UNDOCUMENTED");
      if (record.independent_feature_asof_verified !== true ||
          typeof record.feature_lineage_reference !== "string" ||
          !record.feature_lineage_reference.trim()) issues.push("FEATURE_ASOF_UNVERIFIED");
      if (record.five_jpx_sessions_completed !== true ||
          record.independent_outcome_verified !== true ||
          typeof record.outcome_reference !== "string" ||
          !record.outcome_reference.trim()) issues.push("FORWARD_OUTCOME_UNVERIFIED");
    }
    for (const issue of issues) reasons[issue]=(reasons[issue] ?? 0)+1;
    return {index,status:issues.length?"EVIDENCE_REVIEW_REQUIRED":"DOCUMENTED_CLAIMS_REQUIRE_HUMAN_REVIEW",issues};
  });
  return {
    records_reviewed:records.length,
    missing_evidence_reasons:reasons,
    entries,
    independently_approved_count:0,
    eligible_for_live_ai:false,
    production_write_authorized:false
  };
}
