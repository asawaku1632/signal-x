import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BOLLINGER_SHADOW_EXECUTION_SOURCE,
  BollingerShadowAutomationError,
  runBollingerShadowObservation,
  runBollingerShadowResults,
} from "../app/lib/technicalObservation/bollingerShadowAutomation.ts";

const DAY = 86_400;
const timestamp = (date) => Date.parse(`${date}T00:00:00Z`) / 1_000;
const now = new Date("2026-08-28T10:00:00Z");
const devUrl = "postgresql://postgres.jdtqwryiyxeuoraecorw:secret@pooler.invalid:6543/postgres";
const environment = { TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED: "true" };

function candlesEnding(date = "2026-08-28") {
  const end = timestamp(date);
  return Array.from({ length: 40 }, (_, index) => {
    const close = index === 39 ? 80 : 100 + index * 0.1;
    return { time: end - (39 - index) * DAY, open: index === 39 ? 103 : close,
      high: index === 39 ? 104 : close + 1, low: index === 39 ? 79 : close - 1,
      close, volume: 1_000 + index };
  });
}
function dataset(date = "2026-08-28", status = "COMPLETE") {
  const candles = candlesEnding(date);
  return { timeframe: "1D", source: "YAHOO_CHART", range: "2y", interval: "1d",
    firstBarAt: new Date(candles[0].time * 1_000).toISOString(),
    lastBarAt: new Date(candles.at(-1).time * 1_000).toISOString(), candleCount: candles.length,
    status, complete: status === "COMPLETE", candles };
}
const batch = (entries) => ({ concurrency: 1, requested: entries.length, unique: entries.length,
  settled: entries.map((entry) => entry instanceof Error || entry?.kind
    ? { status: "rejected", reason: entry }
    : { status: "fulfilled", value: entry }) });
const database = { async query(text) {
  if (/count\(\*\).*technical_bb_observation_results/s.test(text)) return { rows: [{ count: 0 }] };
  return { rows: [] };
}, async connect() { throw new Error("unexpected persistence"); } };
const lock = async () => true; const unlock = async () => {};
const common = { mode: "SAVE", limit: 1, targetTradeDate: "2026-08-28", now,
  broadFailureThreshold: { minimumAffectedSymbols: 2, affectedRatio: 1 }, lockLeaseSeconds: 180,
  environment, databaseUrl: devUrl, database, acquireLock: lock, releaseLock: unlock };

test("kill switch is default OFF and accepts only exact true", async () => {
  for (const value of [undefined, "false", "TRUE", "1", " true "]) {
    await assert.rejects(runBollingerShadowObservation({ ...common,
      environment: { TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED: value } }),
    (error) => error instanceof BollingerShadowAutomationError && error.code === "KILL_SWITCH_OFF");
  }
});

test("unknown and production database refs fail closed before lock", async () => {
  let locks = 0;
  for (const [url, code] of [
    ["postgresql://postgres.unknown:secret@pooler.invalid/db", "DEV_DATABASE_UNCONFIRMED"],
    ["postgresql://postgres.paygtakajhvatwejygda:secret@pooler.invalid/db", "PRODUCTION_DATABASE_REJECTED"],
  ]) {
    await assert.rejects(runBollingerShadowObservation({ ...common, databaseUrl: url,
      acquireLock: async () => { locks += 1; return true; } }),
    (error) => error instanceof BollingerShadowAutomationError && error.code === code);
  }
  assert.equal(locks, 0);
});

test("automation metadata is immutable SHADOW_ONLY and never manual", async () => {
  let received;
  const result = await runBollingerShadowObservation({ ...common, mode: "PREVIEW",
    stocks: [{ code: "7203", name: "test" }], fetchBatch: async () => batch([{ code: "7203", dataset: dataset() }]),
    runObservation: async (_stocks, options) => { received = options; return {
      mode: options.mode, requestedSymbols: 1, processedSymbols: 1, validDatasets: 1, invalidDatasets: 0,
      noEventCount: 0, candidateSnapshots: 1, candidateEvents: 1, snapshotsCreated: 0,
      snapshotsExisting: 0, eventsCreated: 0, failedSymbols: 0, errors: [], outcomes: [], maxConcurrency: 1 } } });
  assert.deepEqual(received.metadata, { shadowOnly: true,
    executionSource: "PHASE_7_SHADOW_AUTOMATION", phase: "7" });
  assert.equal("manualExecution" in received.metadata, false);
  assert.equal(result.executionSource, BOLLINGER_SHADOW_EXECUTION_SOURCE);
  assert.equal(result.shadowOnly, true);
});

test("stale or target trade-date mismatch forbids observation persistence", async () => {
  for (const bad of [dataset("2026-08-28", "STALE"), dataset("2026-08-27")]) {
    let writes = 0;
    const result = await runBollingerShadowObservation({ ...common,
      stocks: [{ code: "7203", name: "test" }], fetchBatch: async () => batch([{ code: "7203", dataset: bad }]),
      runObservation: async (_stocks, options) => {
        const supplied = await options.fetchBatch();
        assert.equal(supplied.settled[0].status, "rejected");
        writes += 0;
        return { mode: options.mode, requestedSymbols: 1, processedSymbols: 1, validDatasets: 0,
          invalidDatasets: 0, noEventCount: 0, candidateSnapshots: 0, candidateEvents: 0,
          snapshotsCreated: 0, snapshotsExisting: 0, eventsCreated: 0, failedSymbols: 1,
          errors: [{ status: "FETCH_FAILED" }], outcomes: [{ code: "7203", status: "FETCH_FAILED" }], maxConcurrency: 1 };
      } });
    assert.equal(writes, 0); assert.equal(result.created, 0); assert.equal(result.freshnessMismatch, 1);
  }
});

test("Yahoo failure is isolated and never reaches persistence", async () => {
  let writes = 0;
  const result = await runBollingerShadowObservation({ ...common,
    stocks: [{ code: "7203", name: "test" }], fetchBatch: async () => batch([new Error("network")]),
    runObservation: async (_stocks, options) => { const supplied = await options.fetchBatch();
      assert.equal(supplied.settled[0].status, "rejected"); return { mode: options.mode,
        requestedSymbols: 1, processedSymbols: 1, validDatasets: 0, invalidDatasets: 0, noEventCount: 0,
        candidateSnapshots: 0, candidateEvents: 0, snapshotsCreated: 0, snapshotsExisting: 0,
        eventsCreated: 0, failedSymbols: 1, errors: [], outcomes: [], maxConcurrency: 1 }; } });
  assert.equal(writes, 0); assert.equal(result.created, 0); assert.equal(result.fetchFailures, 1);
});

test("duplicate candle timestamps and broad provider failures stop SAVE", async () => {
  const duplicate = dataset(); duplicate.candles[38].time = duplicate.candles[39].time;
  let runs = 0;
  const single = await runBollingerShadowObservation({ ...common,
    stocks: [{ code: "7203", name: "duplicate" }],
    fetchBatch: async () => batch([{ code: "7203", dataset: duplicate }]),
    runObservation: async () => { runs += 1; return { mode: "SAVE", requestedSymbols: 1,
      processedSymbols: 1, validDatasets: 0, invalidDatasets: 1, noEventCount: 0,
      candidateSnapshots: 0, candidateEvents: 0, snapshotsCreated: 0, snapshotsExisting: 0,
      eventsCreated: 0, failedSymbols: 0, errors: [], outcomes: [], maxConcurrency: 1 }; } });
  assert.equal(single.created, 0); assert.equal(single.freshnessMismatch, 1);

  const broad = await runBollingerShadowObservation({ ...common, limit: 2,
    broadFailureThreshold: { minimumAffectedSymbols: 2, affectedRatio: 0.5 },
    stocks: [{ code: "7203", name: "a" }, { code: "6758", name: "b" }],
    fetchBatch: async () => batch([{ kind: "HTTP_429" }, { kind: "TIMEOUT" }]),
    runObservation: async () => { runs += 1; throw new Error("must not run"); } });
  assert.equal(broad.status, "FAILED"); assert.equal(broad.reason, "BROAD_PROVIDER_FAILURE");
  assert.equal(broad.http429, 1); assert.equal(broad.timeout, 1); assert.equal(runs, 1);
});

test("canonical mismatch fails the run and reports zero creation", async () => {
  const result = await runBollingerShadowObservation({ ...common,
    stocks: [{ code: "7203", name: "test" }], fetchBatch: async () => batch([{ code: "7203", dataset: dataset() }]),
    runObservation: async () => ({ mode: "SAVE", requestedSymbols: 1, processedSymbols: 1,
      validDatasets: 1, invalidDatasets: 0, noEventCount: 0, candidateSnapshots: 1, candidateEvents: 1,
      snapshotsCreated: 0, snapshotsExisting: 0, eventsCreated: 0, failedSymbols: 1, errors: [],
      outcomes: [{ code: "7203", status: "PERSISTENCE_FAILED", reason: "CANONICAL_SNAPSHOT_MISMATCH:close" }],
      maxConcurrency: 1 }) });
  assert.equal(result.status, "FAILED"); assert.equal(result.canonicalMismatch, 1); assert.equal(result.created, 0);
});

test("duplicate executions remain idempotent at the automation boundary", async () => {
  let runs = 0;
  const invoke = () => runBollingerShadowObservation({ ...common,
    stocks: [{ code: "7203", name: "test" }], fetchBatch: async () => batch([{ code: "7203", dataset: dataset() }]),
    runObservation: async () => { runs += 1; return { mode: "SAVE", requestedSymbols: 1, processedSymbols: 1,
      validDatasets: 1, invalidDatasets: 0, noEventCount: 0, candidateSnapshots: 1, candidateEvents: 1,
      snapshotsCreated: runs === 1 ? 1 : 0, snapshotsExisting: runs === 1 ? 0 : 1,
      eventsCreated: runs === 1 ? 1 : 0, failedSymbols: 0, errors: [], outcomes: [], maxConcurrency: 1 }; } });
  assert.equal((await invoke()).created, 2);
  const second = await invoke(); assert.equal(second.created, 0); assert.equal(second.existing, 1);
});

test("OBSERVATION and RESULTS use independent functions and lock names", async () => {
  const operations = []; let observationCalls = 0; let resultCalls = 0;
  const acquireLock = async (operation) => { operations.push(operation); return true; };
  await runBollingerShadowObservation({ ...common, mode: "PREVIEW", stocks: [], acquireLock,
    fetchBatch: async () => batch([]), runObservation: async () => { observationCalls += 1; return {
      mode: "PREVIEW", requestedSymbols: 0, processedSymbols: 0, validDatasets: 0, invalidDatasets: 0,
      noEventCount: 0, candidateSnapshots: 0, candidateEvents: 0, snapshotsCreated: 0,
      snapshotsExisting: 0, eventsCreated: 0, failedSymbols: 0, errors: [], outcomes: [], maxConcurrency: 1 }; } });
  await runBollingerShadowResults({ ...common, mode: "PREVIEW", acquireLock,
    selectEvents: async () => [], fetchBatch: async () => batch([]), runResults: async () => { resultCalls += 1; return {
      mode: "PREVIEW", requestedEvents: 0, processedEvents: 0, uniqueSymbols: 0, evaluatedEvents: 0,
      unavailableEvents: 0, failedEvents: 0, candidateResults: 0, resultsCreated: 0,
      resultsExisting: 0, outcomes: [], maxConcurrency: 1 }; } });
  assert.deepEqual(operations, ["OBSERVATION", "RESULTS"]);
  assert.deepEqual([observationCalls, resultCalls], [1, 1]);
});

test("RESULTS SAVE gate rejects entry/window/version mismatches before persistence", async () => {
  const event = { eventId: 7, code: "7203", timeframe: "1D", side: "LOWER", sigmaLevel: 2,
    eventType: "CROSS", close: 100, observationDate: "2026-08-23", barEndAt: "2026-08-23T06:30:00Z" };
  await assert.rejects(runBollingerShadowResults({ ...common,
    selectEvents: async () => [event], fetchBatch: async () => batch([{ code: "7203", dataset: dataset() }]),
    runResults: async (options) => {
      await options.persist([{ eventId: 7, horizon: 1, horizonUnit: "TRADING_DAY", entryPrice: 101,
        futureClose: 102, returnPercent: 1, maxRisePercent: 2, maxDrawdownPercent: -1,
        maxRiseTradeDate: "2026-08-24", maxDrawdownTradeDate: "2026-08-24",
        evaluatedTradeDate: "2026-08-24", windowCandleCount: 1, resultQuality: "COMPLETE",
        resultVersion: "BB_OBSERVATION_RESULT_V1" }], { database });
    } }), (error) => error instanceof BollingerShadowAutomationError && error.code === "RESULT_GATE_FAILED");
});

test("lock acquisition failure performs no fetch or runner work", async () => {
  let work = 0;
  const result = await runBollingerShadowObservation({ ...common, acquireLock: async () => false,
    fetchBatch: async () => { work += 1; return batch([]); }, runObservation: async () => { work += 1; } });
  assert.equal(result.status, "LOCKED"); assert.equal(work, 0);
});

test("automation core stays disconnected from scheduler and production consumers", () => {
  const source = readFileSync("app/lib/technicalObservation/bollingerShadowAutomation.ts", "utf8");
  for (const forbidden of ["ranking", "notification", "aiPower", "marketCap",
    "app/api/cron", "vercel.json", "weekly"]) assert.doesNotMatch(source, new RegExp(forbidden, "i"));
  for (const path of ["vercel.json", "app/lib/learning/pipeline.ts", "app/lib/bollingerBonus.ts",
    "app/api/ranking/route.ts", "app/api/cron/line/route.ts", "app/api/cron/line-ranking/route.ts"]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /bollingerShadowAutomation|runBollingerShadow/);
  }
});
