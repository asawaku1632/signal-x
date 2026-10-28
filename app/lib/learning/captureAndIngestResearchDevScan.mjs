import { captureResearchDevScanExecution } from "./captureResearchDevScanExecution.mjs";
import { ingestGeneratedScanIntoResearchDev } from "./ingestGeneratedScanIntoResearchDev.mjs";

// Explicitly injected Scan and dev PostgreSQL client; no production routing.
// A single development operation captures original execution times then writes
// only quarantined rows, subject to both independent development safety gates.
export async function captureAndIngestResearchDevScan(runScan, client, options) {
  if (!(process.env.NODE_ENV === "development" || (process.env.NODE_ENV === "test" && process.env.SIGNALX_RESEARCH_ISOLATED_PG === "true")) ||
      process.env.SIGNALX_RESEARCH_CAPTURE !== "true" ||
      process.env.SIGNALX_RESEARCH_DEV_WRITE !== "true")
    throw new Error("RESEARCH_DEV_CAPTURE_AND_WRITE_DISABLED");
  // Never invoke a real provider until its research retention/use permission is reviewed.
  // Isolated CI synthetic PostgreSQL tests do not call real provider services.
  if (process.env.NODE_ENV === "development" &&
      process.env.SIGNALX_RESEARCH_PROVIDER_PERMISSION_CONFIRMED !== "true")
    throw new Error("RESEARCH_PROVIDER_PERMISSION_NOT_CONFIRMED");
  // Reject foreign or unidentifiable DB clients before initiating market-data requests.
  const host = client?.connectionParameters?.host;
  const isolatedCi = process.env.NODE_ENV === "test" &&
    process.env.SIGNALX_RESEARCH_ISOLATED_PG === "true" &&
    (host === "127.0.0.1" || host === "localhost") &&
    client?.connectionParameters?.database === "signalx_research_ci" &&
    client?.connectionParameters?.user === "signalx_ci";
  if (host !== "db.jdtqwryiyxeuoraecorw.supabase.co" && !isolatedCi)
    throw new Error("RESEARCH_DEV_DATABASE_NOT_VERIFIED");
  const captured = await captureResearchDevScanExecution(runScan, options);
  if (!captured.accepted) return {
    accepted:false,reason:captured.reason,inserted:0,persisted:false,promoted:false
  };
  return ingestGeneratedScanIntoResearchDev(client, captured.artifact);
}
