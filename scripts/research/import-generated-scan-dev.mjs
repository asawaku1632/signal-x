// Explicit, offline development-only import of a genuinely generated Scan JSON file.
// Usage: NODE_ENV=development SIGNALX_RESEARCH_DEV_WRITE=true //   SIGNALX_RESEARCH_SCAN_INPUT=/absolute/path/to/generated-scan.json //   DATABASE_URL='postgresql://...development-host...' node scripts/research/import-generated-scan-dev.mjs
// No polling, no live Scan request, no production route, no AI promotion.
import { readFile } from "node:fs/promises";
import pg from "pg";
import { ingestGeneratedScanIntoResearchDev } from "../../app/lib/learning/ingestGeneratedScanIntoResearchDev.mjs";

async function main() {
  if (process.env.NODE_ENV !== "development" ||
      process.env.SIGNALX_RESEARCH_DEV_WRITE !== "true")
    throw new Error("RESEARCH_IMPORT_DISABLED");
  const path = process.env.SIGNALX_RESEARCH_SCAN_INPUT;
  if (!path || !path.startsWith("/")) throw new Error("ABSOLUTE_SCAN_INPUT_REQUIRED");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DEV_DATABASE_URL_REQUIRED");
  const parsed = new URL(url);
  if (parsed.hostname !== "db.jdtqwryiyxeuoraecorw.supabase.co")
    throw new Error("RESEARCH_DEV_DATABASE_NOT_VERIFIED");
  // Validate generation provenance before opening a database connection.
  const { buildGeneratedScanResearchEnvelope } = await import("../../app/lib/learning/buildGeneratedScanResearchEnvelope.mjs");
  const { planScanResearchIntake } = await import("../../app/lib/learning/planScanResearchIntake.mjs");
  const input = JSON.parse(await readFile(path, "utf8"));
  const generation = buildGeneratedScanResearchEnvelope(input);
  if (!generation.accepted) throw new Error(generation.reason);
  const plan = planScanResearchIntake(input);
  if (!plan.valid_for_storage || plan.blocked_count > 0)
    throw new Error("INCOMPLETE_OR_UNSAFE_RESEARCH_RUN");
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const result = await ingestGeneratedScanIntoResearchDev(client, input);
    process.stdout.write(JSON.stringify(result) + "\n");
    if (!result.accepted) process.exitCode = 2;
  } finally { await client.end(); }
}

main().catch(error => {
  process.stderr.write(String(error?.message ?? error) + "\n");
  process.exitCode = 1;
});
