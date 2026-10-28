// Explicit offline import of a completed developer Scan execution JSON.
// This script never invokes production Scan endpoints, cron, or live AI scoring.
// Required: NODE_ENV=development, SIGNALX_RESEARCH_DEV_WRITE=true,
// SIGNALX_RESEARCH_EXECUTION_INPUT=/absolute/path/execution.json, DATABASE_URL=dev only.
// The source file must represent an execution captured at its actual run time.
import { readFile } from "node:fs/promises";
import pg from "pg";
import { createGeneratedScanResearchArtifact } from "../../app/lib/learning/createGeneratedScanResearchArtifact.mjs";
import { planScanResearchIntake } from "../../app/lib/learning/planScanResearchIntake.mjs";
import { ingestCompletedScanExecutionDev } from "../../app/lib/learning/ingestCompletedScanExecutionDev.mjs";

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.SIGNALX_RESEARCH_DEV_WRITE !== "true")
    throw new Error("RESEARCH_IMPORT_DISABLED");
  // Offline import also persists market-derived observations; require the
  // same explicit research-use permission gate as direct development capture.
  if (process.env.SIGNALX_RESEARCH_PROVIDER_PERMISSION_CONFIRMED !== "true")
    throw new Error("RESEARCH_PROVIDER_PERMISSION_NOT_CONFIRMED");
  const path = process.env.SIGNALX_RESEARCH_EXECUTION_INPUT;
  if (!path || !path.startsWith("/")) throw new Error("ABSOLUTE_EXECUTION_INPUT_REQUIRED");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DEV_DATABASE_URL_REQUIRED");
  if (new URL(url).hostname !== "db.jdtqwryiyxeuoraecorw.supabase.co")
    throw new Error("RESEARCH_DEV_DATABASE_NOT_VERIFIED");
  const execution = JSON.parse(await readFile(path, "utf8"));
  // A newly imported file is not proof that a historical observation was
  // captured on that date. Refuse historical replay and future timestamps.
  const completedMs = Date.parse(execution?.scanCompletedAt);
  const ageMs = Date.now() - completedMs;
  if (!Number.isFinite(completedMs) || ageMs < 0 || ageMs > 15 * 60 * 1000)
    throw new Error("SCAN_EXECUTION_NOT_RECENT");
  const generated = createGeneratedScanResearchArtifact(execution);
  if (!generated.accepted) throw new Error(generated.reason);
  const plan = planScanResearchIntake(generated.artifact);
  if (!plan.valid_for_storage || plan.blocked_count !== 0)
    throw new Error("INCOMPLETE_OR_UNSAFE_RESEARCH_RUN");
  const client = new pg.Client({ connectionString:url });
  try {
    await client.connect();
    const result = await ingestCompletedScanExecutionDev(client,execution);
    process.stdout.write(JSON.stringify(result)+"\n");
    if (!result.accepted) process.exitCode=2;
  } finally { await client.end(); }
}
main().catch(error => {
  process.stderr.write(String(error?.message ?? error)+"\n");
  process.exitCode=1;
});
