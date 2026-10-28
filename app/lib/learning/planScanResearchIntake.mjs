import { previewGeneratedScanResearchCapture } from "./previewGeneratedScanResearchCapture.mjs";

// Pure research intake plan. No DB access and no verification promotion.
// Use only genuinely generated Scan payloads with source timestamps.
export function planScanResearchIntake(input) {
  const preview = previewGeneratedScanResearchCapture(input);
  if (!preview.accepted) return {
    accepted:false,reason:preview.reason,valid_for_storage:false,
    candidate_count:0,blocked_count:0,blocked_reasons:{},rows:[],requires_independent_evidence:true,
    total_observations:0,intake_rate_pct:null,ready_for_forward_validation:false
  };
  const allowed = preview.rows.filter(row =>
    row.capture_status === "QUARANTINED" &&
    row.audit_reason === "UNVERIFIED_FEATURE_ASOF_AND_PROVIDER");
  const blocked = preview.rows.length-allowed.length;
  const blockedReasons = {};
  for (const row of preview.rows) {
    if (row.audit_reason === "UNVERIFIED_FEATURE_ASOF_AND_PROVIDER") continue;
    blockedReasons[row.audit_reason] = (blockedReasons[row.audit_reason] ?? 0) + 1;
  }
  return {
    accepted:true,reason:"QUARANTINE_INTAKE_PLAN_ONLY",
    valid_for_storage:allowed.length>0,
    candidate_count:allowed.length,blocked_count:blocked,
    blocked_reasons:blockedReasons,
    rows:allowed,requires_independent_evidence:true,
    total_observations:preview.rows.length,
    intake_rate_pct:preview.rows.length ? 100 * allowed.length / preview.rows.length : null,
    ready_for_forward_validation:false,
    ai_power_recalculated:false,live_notification_enabled:false
  };
}
