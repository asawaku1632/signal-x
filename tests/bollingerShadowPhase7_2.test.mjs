import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { runBollingerShadowDevAdapter } from "../scripts/run-bollinger-shadow-dev.mjs";

const workflow = readFileSync(".github/workflows/bb-shadow-dev.yml", "utf8");
const adapter = readFileSync("scripts/run-bollinger-shadow-dev.mjs", "utf8");
const environment = {
  DATABASE_URL: "postgresql://postgres.jdtqwryiyxeuoraecorw:redacted@pooler.invalid:6543/postgres",
  TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED: "true",
};
const stocksModule = { ACTIVE_STOCKS: Array.from({ length: 20 }, (_, i) => ({ code: `${1000 + i}` })) };

function auditDatabase({ changed = false, lockPresent = false } = {}) {
  let tableRead = 0;
  return { async query(sql) {
    if (String(sql).includes("cron_execution_locks")) return { rows: [{ present: lockPresent }] };
    tableRead += 1;
    return { rows: [{ count: changed && tableRead > 3 ? 2 : 1,
      digest: changed && tableRead > 3 ? "after" : "before" }] };
  } };
}

test("workflow binds only to signalx-dev-shadow without deployment false", () => {
  assert.match(workflow, /environment:\s*\n\s+name: signalx-dev-shadow/);
  assert.doesNotMatch(workflow, /deployment:\s*false/);
  assert.match(workflow, /secrets\.SIGNALX_DEV_DATABASE_URL/);
  assert.match(workflow, /vars\.TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED/);
  assert.doesNotMatch(workflow, /TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED:\s*true/);
});

test("workflow remains dispatch-only, PREVIEW-default, and read-only", () => {
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s*schedule:/m);
  assert.match(workflow, /mode:[\s\S]*default: PREVIEW[\s\S]*- PREVIEW[\s\S]*- SAVE/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
});

test("PREVIEW summary proves safe metadata, release, unchanged tables, and runtime", async () => {
  const technical = { async runBollingerShadowObservation() { return {
    operation: "OBSERVATION", status: "COMPLETED", devConfirmed: true, shadowOnly: true,
    executionSource: "PHASE_7_SHADOW_AUTOMATION", requested: 20, processed: 20, created: 0,
    existing: 0, failed: 0, fetchFailures: 0, http429: 0, timeout: 0,
    freshnessMismatch: 0, canonicalMismatch: 0, runner: { candidateEvents: 2 } } } };
  const summary = await runBollingerShadowDevAdapter({ operation: "OBSERVATION", mode: "PREVIEW",
    environment }, { technical, stocksModule, database: auditDatabase() });
  assert.equal(summary.devConfirmed, true);
  assert.equal(summary.expectedDevProjectRefMatched, true);
  assert.equal(summary.shadowOnly, true);
  assert.equal(summary.executionSource, "PHASE_7_SHADOW_AUTOMATION");
  assert.equal(summary.phase, "7");
  assert.equal(summary.manualExecutionPresent, false);
  assert.equal(summary.candidateCount, 2);
  assert.equal(summary.lockStatus, "ACQUIRED");
  assert.equal(summary.lockReleased, true);
  assert.equal(summary.lockPresentAfterRun, false);
  assert.equal(summary.technicalBbPersistenceAttempted, false);
  assert.equal(summary.technicalBbTablesUnchanged, true);
  assert.equal(summary.productionConsumerInvoked, false);
  assert.ok(Number.isInteger(summary.runtimeMilliseconds) && summary.runtimeMilliseconds >= 0);
  assert.doesNotMatch(JSON.stringify(summary), /postgres(?:ql)?:\/\/|redacted@|pooler\.invalid/i);
});

test("PREVIEW detects a table delta and a remaining operation lock", async () => {
  const technical = { async runBollingerShadowResults() { return {
    status: "COMPLETED", devConfirmed: true, shadowOnly: true, requested: 1, processed: 1,
    created: 0, runner: { candidateResults: 1 } } } };
  const summary = await runBollingerShadowDevAdapter({ operation: "RESULTS", mode: "PREVIEW",
    environment }, { technical, stocksModule, database: auditDatabase({ changed: true, lockPresent: true }) });
  assert.equal(summary.technicalBbTablesUnchanged, false);
  assert.equal(summary.lockPresentAfterRun, true);
  assert.equal(summary.lockReleased, false);
  assert.equal(summary.status, "FAILED");
  assert.equal(summary.reason, "LOCK_NOT_RELEASED");
});

test("adapter audit stays read-only and detached from production consumers", () => {
  assert.doesNotMatch(adapter, /DELETE FROM technical_bb|INSERT INTO technical_bb|UPDATE technical_bb/i);
  for (const forbidden of ["production AI", "AI POWER", "ranking", "notification", "BUY/SELL/WAIT"])
    assert.doesNotMatch(adapter, new RegExp(forbidden, "i"));
});
