import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  PHASE_7_1_CONFIG,
  runBollingerShadowDevAdapter,
} from "../scripts/run-bollinger-shadow-dev.mjs";

const workflow = readFileSync(".github/workflows/bb-shadow-dev.yml", "utf8");
const adapter = readFileSync("scripts/run-bollinger-shadow-dev.mjs", "utf8");
const devUrl = "postgresql://postgres.jdtqwryiyxeuoraecorw:secret@pooler.invalid:6543/postgres";
const environment = { DATABASE_URL: devUrl, TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED: "true" };
const database = { async query() { return { rows: [] }; }, async connect() { throw new Error("unused"); } };
const stocksModule = { ACTIVE_STOCKS: Array.from({ length: 25 }, (_, index) => ({ code: String(1000 + index), name: `s${index}` })) };

test("workflow exposes workflow_dispatch only and no schedule trigger", () => {
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s*schedule:/m);
  assert.doesNotMatch(workflow, /^\s*(push|pull_request):/m);
  assert.match(workflow, /operation:[\s\S]*- OBSERVATION[\s\S]*- RESULTS/);
});

test("workflow uses minimal permissions and read-only checkout token", () => {
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  for (const permission of ["write-all", "actions: write", "deployments:", "issues:", "pull-requests:", "packages: write"])
    assert.doesNotMatch(workflow, new RegExp(permission));
});

test("operation-specific concurrency and two timeout layers are configured", () => {
  assert.match(workflow, /group: signalx-bb-shadow-dev-\$\{\{ inputs\.operation \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /timeout-minutes: 8/);
  assert.equal(PHASE_7_1_CONFIG.hardTimeoutSeconds, 225);
  assert.ok(PHASE_7_1_CONFIG.hardTimeoutSeconds < PHASE_7_1_CONFIG.leaseSeconds);
});

test("secret and kill switch are injected and never hard-coded", () => {
  assert.match(workflow, /secrets\.SIGNALX_DEV_DATABASE_URL/);
  assert.match(workflow, /vars\.TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED/);
  assert.doesNotMatch(workflow, /TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED:\s*true/);
  assert.doesNotMatch(workflow, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(adapter, /SIGNALX_DEV_DATABASE_URL\s*=/);
});

test("Phase 7.1 constants are explicit and have no core defaults", () => {
  assert.equal(PHASE_7_1_CONFIG.devProjectRef, "jdtqwryiyxeuoraecorw");
  assert.equal(PHASE_7_1_CONFIG.leaseSeconds, 300);
  assert.equal(PHASE_7_1_CONFIG.limit, 20);
  assert.equal(PHASE_7_1_CONFIG.concurrency, 1);
  assert.deepEqual(PHASE_7_1_CONFIG.broadFailureThreshold,
    { minimumAffectedSymbols: 2, affectedRatio: 0.10 });
});

test("kill switch OFF and non-DEV database reject before dependencies", async () => {
  let loaded = 0;
  await assert.rejects(runBollingerShadowDevAdapter({ operation: "OBSERVATION", mode: "PREVIEW",
    environment: { DATABASE_URL: devUrl } }, { get technical() { loaded += 1; return {}; } }), /KILL_SWITCH_OFF/);
  await assert.rejects(runBollingerShadowDevAdapter({ operation: "RESULTS", mode: "PREVIEW",
    environment: { DATABASE_URL: "postgresql://postgres.paygtakajhvatwejygda:x@pooler.invalid/db",
      TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED: "true" } }, {}), /PRODUCTION_DATABASE_REJECTED/);
  assert.equal(loaded, 0);
});

test("OBSERVATION uses stable first 20 and passes lock/threshold metadata to core", async () => {
  let received;
  const technical = { async runBollingerShadowObservation(options) { received = options; return {
    status: "COMPLETED", created: 0, shadowOnly: true, executionSource: "PHASE_7_SHADOW_AUTOMATION" }; } };
  const result = await runBollingerShadowDevAdapter({ operation: "OBSERVATION", mode: "PREVIEW",
    environment, now: new Date("2026-08-28T10:00:00Z") }, { technical, stocksModule, database });
  assert.equal(received.stocks.length, 20);
  assert.deepEqual(received.stocks, stocksModule.ACTIVE_STOCKS.slice(0, 20));
  assert.equal(received.lockLeaseSeconds, 300);
  assert.deepEqual(received.broadFailureThreshold, { minimumAffectedSymbols: 2, affectedRatio: 0.10 });
  assert.equal(received.targetTradeDate, "2026-08-28");
  assert.equal(result.created, 0);
});

test("calendar resolution fails before database, lock, Yahoo, or runner work", async () => {
  let work = 0;
  const unavailable = () => { throw Object.assign(new Error("MARKET_CALENDAR_UNAVAILABLE"),
    { code: "MARKET_CALENDAR_UNAVAILABLE" }); };
  await assert.rejects(runBollingerShadowDevAdapter({ operation: "OBSERVATION", mode: "PREVIEW",
    environment }, { resolveTargetTradeDate: unavailable,
    get technical() { work += 1; return {}; }, get database() { work += 1; return {}; } }),
  /MARKET_CALENDAR_UNAVAILABLE/);
  assert.equal(work, 0);
});

test("OBSERVATION and RESULTS call only their independent core functions", async () => {
  const calls = [];
  const technical = { async runBollingerShadowObservation() { calls.push("OBSERVATION"); return { status: "COMPLETED" }; },
    async runBollingerShadowResults(options) { calls.push("RESULTS"); assert.equal(options.limit, 20); return { status: "COMPLETED" }; } };
  await runBollingerShadowDevAdapter({ operation: "OBSERVATION", mode: "PREVIEW", environment }, { technical, stocksModule, database });
  await runBollingerShadowDevAdapter({ operation: "RESULTS", mode: "PREVIEW", environment }, { technical, stocksModule, database });
  assert.deepEqual(calls, ["OBSERVATION", "RESULTS"]);
});

test("adapter remains detached from scheduler HTTP and production consumers", () => {
  for (const forbidden of ["api/cron", "technical-bb-observation", "ranking", "notification", "aiPower",
    "marketCap", "vercel.json", "weekly"]) assert.doesNotMatch(adapter, new RegExp(forbidden, "i"));
});

test("CLI with kill switch unset fails safely without printing a connection string", () => {
  const run = spawnSync(process.execPath, ["scripts/run-bollinger-shadow-dev.mjs", "OBSERVATION", "PREVIEW"],
    { encoding: "utf8", env: {} });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /KILL_SWITCH_OFF/);
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /postgres(?:ql)?:\/\//i);
});
