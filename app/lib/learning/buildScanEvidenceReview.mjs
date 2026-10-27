import { assessCaptureForReview } from "./assessCaptureForReview.mjs";

// Pure, read-only bridge from stored Scan rows to evidence review.
// No database calls, no status promotion, no live AI effects.
export function buildScanEvidenceReview(captures, evidenceRecords) {
  if (!Array.isArray(captures) || !Array.isArray(evidenceRecords)) {
    throw new TypeError("INVALID_RESEARCH_INPUT");
  }
  const index = new Map();
  for (const evidence of evidenceRecords) {
    const key = JSON.stringify([evidence?.scan_run_id, evidence?.code]);
    const group = index.get(key) ?? [];
    group.push(evidence);
    index.set(key, group);
  }
  const results = [];
  for (const capture of captures) {
    const key = JSON.stringify([capture?.scan_run_id, capture?.code]);
    const evidence = index.get(key) ?? [];
    const assessment = evidence.length === 1
      ? assessCaptureForReview(capture, evidence[0])
      : { eligible: false, reason: evidence.length ? "AMBIGUOUS_EVIDENCE" : "MISSING_INDEPENDENT_EVIDENCE" };
    results.push({
      scan_run_id: capture?.scan_run_id ?? null,
      code: capture?.code ?? null,
      review_ready: assessment.eligible,
      reason: assessment.reason,
      // Explicitly prohibit downstream code interpreting this as verified.
      asof_verified: false,
    });
  }
  return results;
}
