import { createGeneratedScanResearchArtifact } from "./createGeneratedScanResearchArtifact.mjs";
import { ingestGeneratedScanIntoResearchDev } from "./ingestGeneratedScanIntoResearchDev.mjs";

// Explicit development-only bridge, never called from live Scan routes.
// The upstream caller must actually execute Scan and supply its original timestamps.
export async function ingestCompletedScanExecutionDev(client, execution) {
  const prepared = createGeneratedScanResearchArtifact(execution);
  if (!prepared.accepted) return {
    accepted:false,reason:prepared.reason,inserted:0,persisted:false,promoted:false
  };
  return ingestGeneratedScanIntoResearchDev(client, prepared.artifact);
}
