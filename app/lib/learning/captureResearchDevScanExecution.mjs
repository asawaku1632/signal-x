import { randomUUID } from "node:crypto";
import { createGeneratedScanResearchArtifact } from "./createGeneratedScanResearchArtifact.mjs";
import { planScanResearchIntake } from "./planScanResearchIntake.mjs";

// Research-only execution wrapper. Caller injects the scan function; this module
// never imports production Scan routes, schedules jobs, or writes databases.
export async function captureResearchDevScanExecution(runScan, { limit, now = () => new Date(), id = randomUUID } = {}) {
  if (!(process.env.NODE_ENV === "development" || (process.env.NODE_ENV === "test" && process.env.SIGNALX_RESEARCH_ISOLATED_PG === "true")) || process.env.SIGNALX_RESEARCH_CAPTURE !== "true")
    throw new Error("RESEARCH_CAPTURE_DISABLED");
  if (typeof runScan !== "function" || !Number.isInteger(limit) || limit < 1 || limit > 1200)
    throw new Error("INVALID_RESEARCH_SCAN_REQUEST");
  const startedAt = now().toISOString();
  const scanResult = await runScan(limit);
  const completedAt = now().toISOString();
  const prepared = createGeneratedScanResearchArtifact({
    scanResult, scanStartedAt: startedAt, scanCompletedAt: completedAt, scanRunId: id()
  });
  if (!prepared.accepted) return prepared;
  const plan = planScanResearchIntake(prepared.artifact);
  if (!plan.valid_for_storage || plan.blocked_count !== 0)
    return { accepted:false,reason:"INCOMPLETE_OR_UNSAFE_RESEARCH_RUN",artifact:null,blocked_reasons:plan.blocked_reasons };
  return prepared;
}
