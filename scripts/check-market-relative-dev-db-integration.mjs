/**
 * Manual development-only integration probe.
 * Never run in production or CI by default.
 * Requires explicit dev project ID and dev-only Postgres connection.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import pg from "pg";
import { randomUUID } from "node:crypto";

const DEV_PROJECT = "jdtqwryiyxeuoraecorw";
const url = process.env.SIGNALX_RESEARCH_DEV_DATABASE_URL;
if (process.env.SIGNALX_RESEARCH_DEV_PROJECT_ID !== DEV_PROJECT ||
    process.env.SIGNALX_RESEARCH_DEV_DB_TEST !== "I_UNDERSTAND_DEV_ONLY" ||
    !url) {
  throw new Error("Dev-only opt-in environment is required");
}
const parsed = new URL(url);
if (!["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.hostname !== "db." + DEV_PROJECT + ".supabase.co") {
  throw new Error("Database host does not match approved development project");
}

function load(path, dependency = () => { throw new Error("Unexpected import"); }) {
  const source = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: dependency, Date, Number });
  return exports;
}
const validation = load("app/lib/research/marketRelativeProspectiveSnapshot.ts");
const insert = load("app/lib/research/marketRelativeSnapshotInsertPlan.ts", () => validation);
const conflict = load("app/lib/research/marketRelativeSnapshotConflict.ts");
const persistence = load("app/lib/research/marketRelativeSnapshotPersistence.ts", name =>
  name.includes("InsertPlan") ? insert : conflict);

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
await client.connect();
let transactionStarted = false;
try {
  const identity = await client.query("select current_database() as db");
  await client.query("BEGIN");
  transactionStarted = true;
  const input = {
    signalId: "dev-only-integration-" + randomUUID(),
    code: "9684", aiPower: 93, price: 3000,
    priceObservedAt: "2026-10-21T09:05:00+09:00",
    signalObservedAt: "2026-10-21T09:05:10+09:00",
    capturedAt: "2026-10-21T09:05:15+09:00",
    source: "synthetic-integration", version: "dev-v1",
  };
  const storage = { query: (sql, params) => client.query(sql, params) };
  assert.equal((await persistence.persistResearchSnapshot(storage, input)).status, "inserted");
  assert.equal((await persistence.persistResearchSnapshot(storage, input)).status, "duplicate");
  assert.equal((await persistence.persistResearchSnapshot(storage, { ...input, aiPower: 10 })).status, "conflict");
  const original = await client.query(
    "select ai_power from public.market_relative_prospective_ledger where signal_id=$1",
    [input.signalId],
  );
  assert.equal(Number(original.rows[0].ai_power), 93);
  console.log("PASS: 4 real PostgreSQL development integration assertions", identity.rows[0].db);
} finally {
  if (transactionStarted) await client.query("ROLLBACK");
  await client.end();
}
