import { buildGeneratedScanResearchEnvelope } from "./buildGeneratedScanResearchEnvelope.mjs";
import { saveResearchScanCaptureDev } from "./saveResearchScanCaptureDev.mjs";

// Explicit development-only ingestion entry point. Never used by live Scan.
// Requires a caller-supplied generated payload and the dev writer's existing
// host, environment, and quarantine checks. No automatic refresh or scoring.
export async function ingestGeneratedScanIntoResearchDev(client, input) {
  const generated = buildGeneratedScanResearchEnvelope(input);
  if (!generated.accepted) return {
    accepted: false, reason: generated.reason, inserted: 0,
    persisted: false, promoted: false
  };
  const summary = await saveResearchScanCaptureDev(client, generated.envelope);
  return {
    accepted: true, reason: "QUARANTINED_DEV_CAPTURE",
    ...summary, persisted: summary.inserted > 0, promoted: false
  };
}
