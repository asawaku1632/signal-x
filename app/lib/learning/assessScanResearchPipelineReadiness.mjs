import { planScanResearchIntake } from "./planScanResearchIntake.mjs";

// Research-only report for operators. No DB, no market download, no auto-promotion.
// Distinguish observation readiness from independent verification completeness.
export function assessScanResearchPipelineReadiness(input, evidenceRecords = [], outcomes = []) {
  if (!Array.isArray(evidenceRecords) || !Array.isArray(outcomes))
    throw new TypeError("INVALID_RESEARCH_EVIDENCE_COLLECTIONS");
  const plan = planScanResearchIntake(input);
  const status = !plan.accepted ? "INVALID_GENERATED_SCAN"
    : !plan.valid_for_storage ? "NO_INTAKE_CANDIDATES"
    : "QUARANTINED_INTAKE_ONLY";
  return {
    status,
    intake: plan,
    independent_evidence_records_supplied: evidenceRecords.length,
    forward_outcomes_supplied: outcomes.length,
    verified_predictions: 0,
    verified_forward_results: 0,
    eligible_for_live_ai: false,
    production_write_authorized: false,
    next_requirement: !plan.valid_for_storage
      ? "VALID_FRESH_GENERATION_AND_ASOF_SOURCE_BAR"
      : "INDEPENDENT_PROVIDER_FEATURE_LINEAGE_AND_FIVE_SESSION_OUTCOMES"
  };
}
