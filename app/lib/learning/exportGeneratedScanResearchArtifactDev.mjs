import { writeFile } from "node:fs/promises";
import { createGeneratedScanResearchArtifact } from "./createGeneratedScanResearchArtifact.mjs";
import { planScanResearchIntake } from "./planScanResearchIntake.mjs";

// Development-only file export. Caller must provide the real completed Scan result.
// No access to runtime Scan endpoints, database or scoring functions.
export async function exportGeneratedScanResearchArtifactDev(input, destination) {
  if (process.env.NODE_ENV !== "development" ||
      process.env.SIGNALX_RESEARCH_EXPORT_ENABLED !== "true")
    throw new Error("RESEARCH_EXPORT_DISABLED");
  if (typeof destination !== "string" || !destination.startsWith("/") ||
      !destination.endsWith(".json")) throw new Error("INVALID_ARTIFACT_DESTINATION");
  const built = createGeneratedScanResearchArtifact(input);
  if (!built.accepted) return {exported:false,reason:built.reason};
  const plan = planScanResearchIntake(built.artifact);
  if (!plan.valid_for_storage || plan.blocked_count)
    return {exported:false,reason:"INCOMPLETE_OR_UNSAFE_RESEARCH_RUN"};
  await writeFile(destination,JSON.stringify(built.artifact,null,2)+"\n",{flag:"wx",mode:0o600});
  return {exported:true,reason:"UNVERIFIED_RESEARCH_ARTIFACT_ONLY",
    scan_run_id:built.artifact.scanRunId,observations:plan.candidate_count};
}
