import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const file = "scripts/check-market-relative-dev-db-integration.mjs";
const source = fs.readFileSync(file, "utf8");
execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
let checks = 1;
const required = [
  'SIGNALX_RESEARCH_DEV_DATABASE_URL',
  'SIGNALX_RESEARCH_DEV_PROJECT_ID',
  'SIGNALX_RESEARCH_DEV_DB_TEST',
  'I_UNDERSTAND_DEV_ONLY',
  'db." + DEV_PROJECT + ".supabase.co',
  'aws-0-ap-northeast-1.pooler.supabase.com',
  'parsed.username === "postgres." + DEV_PROJECT',
  'parsed.port === "5432"',
  'await client.query("BEGIN")',
  'await client.query("ROLLBACK")',
  'persistResearchSnapshot(storage, input)',
  'persistResearchSnapshot(storage, { ...input, aiPower: 10 })',
];
for (const fragment of required) {
  assert.ok(source.includes(fragment), "Missing integration safeguard: " + fragment);
  checks++;
}
const workflow = fs.readFileSync(".github/workflows/market-index-shadow-check.yml", "utf8");
assert.ok(!workflow.includes("node scripts/check-market-relative-dev-db-integration.mjs"), "Integration probe must never auto-run in CI");
checks++;
console.log("PASS: " + checks + " dev-only integration harness checks");
