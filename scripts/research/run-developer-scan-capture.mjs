// Explicit developer-only Scan runner: never used by routes, cron or production.
// Captures clock times around the *actual* scan execution, not reconstructed history.
// Requires locally configured development-only data sources and an explicit flag.
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";

async function main() {
  if (process.env.NODE_ENV !== "development" ||
      process.env.SIGNALX_RESEARCH_DEV_SCAN_RUN !== "true") throw new Error("RESEARCH_DEV_SCAN_DISABLED");
  const output = process.env.SIGNALX_RESEARCH_OUTPUT;
  if (!output || !output.startsWith("/")) throw new Error("ABSOLUTE_OUTPUT_REQUIRED");
  // Do not run or import the application scanner until explicit gates pass.
  const { register } = await import("node:module");
  register("tsx/esm", import.meta.url);
  const scanModule = await import("../../app/lib/learning/scanEngine.ts");
  const limit = Number(process.env.SIGNALX_RESEARCH_DEV_SCAN_LIMIT ?? 1);
  if (!Number.isInteger(limit) || limit !== 1) throw new Error("DEV_SCAN_LIMIT_MUST_BE_ONE");
  const scanStartedAt = new Date().toISOString();
  const scanResult = await scanModule.runScan(limit);
  const scanCompletedAt = new Date().toISOString();
  const { createGeneratedScanResearchArtifact } = await import("../../app/lib/learning/createGeneratedScanResearchArtifact.mjs");
  const generated = createGeneratedScanResearchArtifact({
    scanResult,scanStartedAt,scanCompletedAt,scanRunId:randomUUID()
  });
  if (!generated.accepted) throw new Error(generated.reason);
  const { planScanResearchIntake } = await import("../../app/lib/learning/planScanResearchIntake.mjs");
  const plan=planScanResearchIntake(generated.artifact);
  if (!plan.valid_for_storage || plan.blocked_count !== 0) throw new Error("INCOMPLETE_OR_UNSAFE_RESEARCH_RUN");
  await writeFile(resolve(output),JSON.stringify(generated.artifact,null,2),{flag:"wx",mode:0o600});
  process.stdout.write(JSON.stringify({saved:true,source:"actual_dev_scan",count:plan.candidate_count,verified:false})+"\n");
}
main().catch(e=>{process.stderr.write(String(e?.message??e)+"\n");process.exitCode=1;});
