import { previewGeneratedScanResearchCapture } from "./previewGeneratedScanResearchCapture.mjs";

// Pure research intake plan. No DB access and no verification promotion.
// Use only genuinely generated Scan payloads with source timestamps.
export function planScanResearchIntake(input) {
  const preview = previewGeneratedScanResearchCapture(input);
  if (!preview.accepted) return {
    accepted:false,reason:preview.reason,valid_for_storage:false,
    candidate_count:0,blocked_count:0,rows:[],requires_independent_evidence:true
  };
  const allowed = preview.rows.filter(row =>
    row.capture_status === "QUARANTINED" &&
    row.audit_reason === "UNVERIFIED_FEATURE_ASOF_AND_PROVIDER");
  const blocked = preview.rows.length-allowed.length;
  return {
    accepted:true,reason:"QUARANTINE_INTAKE_PLAN_ONLY",
    valid_for_storage:allowed.length>0,
    candidate_count:allowed.length,blocked_count:blocked,
    rows:allowed,requires_independent_evidence:true,
    ai_power_recalculated:false,live_notification_enabled:false
  };
}
