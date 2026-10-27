// Research-only gate. Never upgrades database rows or changes live AI.
// A time comparison alone cannot establish independently verified provenance.
export function assessCaptureForReview(capture, evidence) {
  const fail = reason => ({ eligible: false, reason });
  if (!capture || capture.capture_status !== "QUARANTINED") return fail("INVALID_CAPTURE_STATE");
  if (!evidence || evidence.independently_verified !== true ||
      evidence.provider_license_verified !== true ||
      evidence.feature_lineage_verified !== true) return fail("MISSING_INDEPENDENT_EVIDENCE");
  if (evidence.scan_run_id !== capture.scan_run_id ||
      evidence.code !== capture.code) return fail("EVIDENCE_IDENTITY_MISMATCH");
  const times = [capture.scan_received_at, capture.source_bar_at,
    evidence.feature_computed_at, evidence.provider_observed_at];
  if (times.some(t => typeof t !== "string" || !Number.isFinite(Date.parse(t))))
    return fail("INVALID_EVIDENCE_TIME");
  const received = Date.parse(times[0]);
  if (times.slice(1).some(t => Date.parse(t) > received))
    return fail("POST_PREDICTION_INFORMATION");
  if (evidence.source_bar_at !== capture.source_bar_at)
    return fail("SOURCE_BAR_MISMATCH");
  // Review eligibility is not verification and does not authorize a status update.
  return { eligible: true, reason: "REVIEW_READY_NOT_VERIFIED" };
}
