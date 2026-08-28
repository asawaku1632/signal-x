import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  executeBollingerManualOperation,
  parseBollingerManualRequest,
} from "../app/lib/technicalObservation/bollingerObservationManual.ts";
import {
  authorizeBollingerManualAccess,
  handleBollingerManualRequest,
} from "../app/lib/technicalObservation/bollingerObservationManualEndpoint.ts";

const observationResult = (mode = "PREVIEW") => ({ mode, requestedSymbols: 1, processedSymbols: 1,
  validDatasets: 1, invalidDatasets: 0, noEventCount: 0, candidateSnapshots: 1, candidateEvents: 2,
  snapshotsCreated: mode === "SAVE" ? 1 : 0, snapshotsExisting: 0,
  eventsCreated: mode === "SAVE" ? 2 : 0, failedSymbols: 0, errors: [],
  outcomes: [{ code: "1332", status: "SUCCESS", eventCount: 2 }], maxConcurrency: 1 });

const resultRun = (mode = "PREVIEW") => ({ mode, requestedEvents: 1, processedEvents: 1,
  uniqueSymbols: 1, evaluatedEvents: 1, unavailableEvents: 1, failedEvents: 0,
  candidateResults: 0, resultsCreated: 0, resultsExisting: 0,
  outcomes: [{ eventId: 1, code: "1332", status: "NO_RESULT_AVAILABLE", completedHorizons: [] }],
  maxConcurrency: 1 });

test("manual access requires authentication and admin authorization", () => {
  assert.equal(authorizeBollingerManualAccess({ authenticated: false, isAdmin: false }).status, 401);
  assert.equal(authorizeBollingerManualAccess({ authenticated: true, isAdmin: false }).status, 403);
  assert.equal(authorizeBollingerManualAccess({ authenticated: true, isAdmin: true }), null);
});

test("manual request defaults to PREVIEW/20 and SAVE requires explicit safe limit", () => {
  assert.deepEqual(parseBollingerManualRequest({ operation: "OBSERVATION" }),
    { operation: "OBSERVATION", mode: "PREVIEW", limit: 20 });
  assert.throws(() => parseBollingerManualRequest({ operation: "OBSERVATION", mode: "SAVE" }),
    /SAVE_LIMIT_REQUIRED/);
  for (const limit of [0, 51, NaN, Infinity]) assert.throws(() =>
    parseBollingerManualRequest({ operation: "OBSERVATION", limit }), /LIMIT/);
});

test("operation, mode, timeframe, body, and ACTIVE_STOCKS codes are validated", () => {
  for (const body of [null, {}, { operation: "BAD" }, { operation: "RESULTS", mode: "BAD" },
    { operation: "OBSERVATION", timeframe: "1W" },
    { operation: "OBSERVATION", codes: ["__INJECTED__"] },
    { operation: "RESULTS", codes: ["1332"] }]) {
    assert.throws(() => parseBollingerManualRequest(body), /INVALID_MANUAL_REQUEST/);
  }
  assert.deepEqual(parseBollingerManualRequest({ operation: "OBSERVATION", codes: ["1332"] }).codes,
    ["1332"]);
});

test("PREVIEW delegates to Phase 6 runner with zero writes and deterministic shadow metadata", async () => {
  let options;
  const result = await executeBollingerManualOperation({ operation: "OBSERVATION", codes: ["1332"] }, {
    runObservation: async (_stocks, input) => { options = input; return observationResult(input.mode); },
    now: () => new Date("2026-08-22T00:00:00Z"), audit() {},
  });
  assert.equal(options.mode, "PREVIEW");
  assert.equal(result.audit.snapshotsCreated, 0);
  assert.deepEqual(options.metadata, { shadowOnly: true, manualExecution: true,
    executionSource: "PHASE_6_1_MANUAL", phase: "6.1" });
  assert.equal(Object.keys(options.metadata).some((key) => /time|request/i.test(key)), false);
});

test("explicit SAVE and OBSERVATION/RESULTS are separately delegated", async () => {
  let observationCalls = 0; let resultCalls = 0;
  const dependencies = { audit() {}, runObservation: async (_stocks, options) => {
    observationCalls += 1; return observationResult(options.mode); },
  runResults: async (options) => { resultCalls += 1; return resultRun(options.mode); } };
  const saved = await executeBollingerManualOperation({ operation: "OBSERVATION", mode: "SAVE", limit: 1 },
    dependencies);
  assert.equal(saved.audit.snapshotsCreated, 1);
  assert.deepEqual([observationCalls, resultCalls], [1, 0]);
  const results = await executeBollingerManualOperation({ operation: "RESULTS", mode: "PREVIEW", limit: 1 },
    dependencies);
  assert.equal(results.audit.noResultAvailable, 1);
  assert.deepEqual([observationCalls, resultCalls], [1, 1]);
});

test("endpoint rejects unauthenticated/non-admin/invalid and does not leak runner errors", async () => {
  assert.equal((await handleBollingerManualRequest({}, { authenticated: false, isAdmin: false })).status, 401);
  assert.equal((await handleBollingerManualRequest({}, { authenticated: true, isAdmin: false })).status, 403);
  assert.equal((await handleBollingerManualRequest({}, { authenticated: true, isAdmin: true })).status, 400);
  const failed = await handleBollingerManualRequest({ operation: "RESULTS" },
    { authenticated: true, isAdmin: true }, { runResults: async () => { throw new Error("secret provider body"); } });
  assert.equal(failed.status, 500);
  assert.equal(failed.body.error, "Manual execution failed");
  assert.doesNotMatch(JSON.stringify(failed.body), /secret provider body/);
});

test("route is POST-only/no-store and remains disconnected from Cron and consumers", () => {
  const route = readFileSync("app/api/admin/technical-bb-observation/route.ts", "utf8");
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.match(route, /getAdminSession/);
  assert.match(route, /no-store/);
  for (const path of ["vercel.json", "app/lib/learning/pipeline.ts", "app/lib/bollingerBonus.ts",
    "app/api/ranking/route.ts", "app/api/cron/technical-observation/route.ts",
    "app/api/cron/line/route.ts", "app/learning/page.tsx", "app/result-stats/page.tsx"]) {
    if (existsSync(path)) assert.doesNotMatch(readFileSync(path, "utf8"), /technical-bb-observation|bollingerObservationManual/);
  }
});
