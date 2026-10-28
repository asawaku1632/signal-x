import { captureResearchDevScanExecution } from "./captureResearchDevScanExecution.mjs";
import { ingestGeneratedScanIntoResearchDev } from "./ingestGeneratedScanIntoResearchDev.mjs";

// Explicitly injected Scan and dev PostgreSQL client; no production routing.
// A single development operation captures original execution times then writes
// only quarantined rows, subject to both independent development safety gates.
export async function captureAndIngestResearchDevScan(runScan, client, options) {
  if (process.env.NODE_ENV !== "development" ||
      process.env.SIGNALX_RESEARCH_CAPTURE !== "true" ||
      process.env.SIGNALX_RESEARCH_DEV_WRITE !== "true")
    throw new Error("RESEARCH_DEV_CAPTURE_AND_WRITE_DISABLED");
  const captured = await captureResearchDevScanExecution(runScan, options);
  if (!captured.accepted) return {
    accepted:false,reason:captured.reason,inserted:0,persisted:false,promoted:false
  };
  return ingestGeneratedScanIntoResearchDev(client, captured.artifact);
}
