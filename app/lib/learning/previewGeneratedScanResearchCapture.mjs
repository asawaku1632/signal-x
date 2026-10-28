import { buildGeneratedScanResearchEnvelope } from "./buildGeneratedScanResearchEnvelope.mjs";
import { prepareScanFeatureCaptures } from "./prepareScanFeatureCaptures.mjs";

// Offline, read-only preview of a *newly generated* Scan research capture.
// This never invokes a database client, public route, live scorer or notification.
export function previewGeneratedScanResearchCapture(input) {
  const generated = buildGeneratedScanResearchEnvelope(input);
  if (!generated.accepted) return {
    accepted: false, reason: generated.reason, attempted: 0,
    rows: [], persisted: false, live_ai_updated: false
  };
  const rows = prepareScanFeatureCaptures(generated.envelope);
  const reasons = {};
  for (const row of rows) reasons[row.audit_reason] = (reasons[row.audit_reason] ?? 0) + 1;
  return {
    accepted: true, reason: "PREVIEW_QUARANTINED_NOT_PERSISTED",
    attempted: rows.length, unique_codes: new Set(rows.map(x=>x.code)).size,
    reasons, rows, persisted: false, live_ai_updated: false
  };
}
