import { previewGeneratedScanResearchCapture } from "./previewGeneratedScanResearchCapture.mjs";
import { summarizeVerifiedForwardResearch } from "./summarizeVerifiedForwardResearch.mjs";

// Research-only pipeline audit; no persistence and no automatic verification.
// Preview output is always QUARANTINED, so cannot enter forward performance.
export function auditGeneratedScanBeforeForwardResearch(input, outcomes = []) {
  if (!Array.isArray(outcomes)) throw new TypeError("INVALID_RESEARCH_OUTCOMES");
  const preview = previewGeneratedScanResearchCapture(input);
  if (!preview.accepted) return {
    preview, report: null, safe_to_promote: false, saved: false
  };
  const report = summarizeVerifiedForwardResearch(preview.rows, outcomes);
  return {
    preview, report, safe_to_promote: false, saved: false
  };
}
