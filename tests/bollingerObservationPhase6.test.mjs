import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildLatestBollingerObservationCandidate,
  runBollingerObservationBatch,
} from "../app/lib/technicalObservation/bollingerObservationRunner.ts";
import {
  futureCandlesFromDataset,
  runBollingerResultBatch,
} from "../app/lib/technicalObservation/bollingerObservationResultRunner.ts";

const DAY = 86_400;
const time = (date) => Date.parse(`${date}T00:00:00Z`) / 1_000;
const now = new Date("2026-08-22T12:00:00Z");

function dataset(closes, options = {}) {
  const start = time(options.start ?? "2026-07-01");
  const candles = closes.map((close, index) => ({ time: start + index * DAY,
    open: options.open?.(close, index) ?? close,
    high: options.high?.(close, index) ?? close + 1,
    low: options.low?.(close, index) ?? close - 1,
    close, volume: 1_000 + index }));
  return { timeframe: options.timeframe ?? "1D", source: "YAHOO_CHART", range: "2y", interval: "1d",
    firstBarAt: new Date(candles[0].time * 1_000).toISOString(),
    lastBarAt: new Date(candles.at(-1).time * 1_000).toISOString(), candleCount: candles.length,
    status: options.status ?? "COMPLETE", complete: (options.status ?? "COMPLETE") === "COMPLETE", candles };
}

function crossDataset() {
  const closes = Array.from({ length: 39 }, (_, index) => 100 + index * 0.1); closes.push(80);
  return dataset(closes, { start: "2026-07-13", open: (close, index) => index === 39 ? 103 : close,
    high: (close, index) => index === 39 ? 104 : close + 1,
    low: (close, index) => index === 39 ? 79 : close - 1 });
}

function touchDataset() {
  const closes = Array.from({ length: 40 }, (_, index) => 100 + index * 0.1);
  return dataset(closes, { start: "2026-07-13", low: (close, index) => index === 39 ? 80 : close - 1 });
}

function batch(entries, concurrency = 2) {
  return { concurrency, requested: entries.length, unique: entries.length,
    settled: entries.map((entry) => entry instanceof Error
      ? { status: "rejected", reason: entry }
      : { status: "fulfilled", value: entry }) };
}

test("latest confirmed candidate detects independent 2/3 sigma CROSS with partial Evidence", () => {
  const candidate = buildLatestBollingerObservationCandidate({ code: "7203", dataset: crossDataset(), now });
  assert.ok(candidate);
  assert.ok(candidate.events.some((event) => event.type === "CROSS" && event.sigmaLevel === 2));
  assert.ok(candidate.events.some((event) => event.type === "CROSS" && event.sigmaLevel === 3));
  assert.equal(candidate.evidence.indicators.ema.availability, "INSUFFICIENT_HISTORY");
  assert.equal(candidate.timeframe, "1D");
});

test("TOUCH-only candidate does not fabricate CROSS", () => {
  const candidate = buildLatestBollingerObservationCandidate({ code: "7203", dataset: touchDataset(), now });
  assert.ok(candidate);
  assert.ok(candidate.events.some((event) => event.type === "TOUCH"));
  assert.equal(candidate.events.some((event) => event.type === "CROSS"), false);
});

test("invalid BB, stale, incomplete, and forming latest candles are not candidates", () => {
  assert.equal(buildLatestBollingerObservationCandidate({ code: "7203",
    dataset: dataset(Array(40).fill(100), { start: "2026-07-13" }), now }), null);
  assert.equal(buildLatestBollingerObservationCandidate({ code: "7203",
    dataset: dataset(Array(40).fill(100), { status: "STALE" }), now }), null);
  assert.equal(buildLatestBollingerObservationCandidate({ code: "7203",
    dataset: dataset(Array(40).fill(100), { status: "INCOMPLETE" }), now }), null);
  const forming = crossDataset(); forming.candles.at(-1).time = time("2026-08-22");
  const priorConfirmed = buildLatestBollingerObservationCandidate({ code: "7203", dataset: forming,
    now: new Date("2026-08-22T05:00:00Z") });
  assert.notEqual(priorConfirmed?.observationDate, "2026-08-22");
});

test("PREVIEW creates candidates but performs zero writes", async () => {
  let writes = 0;
  const result = await runBollingerObservationBatch([{ code: "7203", name: "test" }], {
    limit: 1, mode: "PREVIEW", now, fetchBatch: async () => batch([{ code: "7203", dataset: crossDataset() }]),
    persist: async () => { writes += 1; throw new Error("must not run"); },
  });
  assert.equal(result.candidateSnapshots, 1);
  assert.ok(result.candidateEvents >= 2);
  assert.equal(result.snapshotsCreated, 0);
  assert.equal(result.eventsCreated, 0);
  assert.equal(writes, 0);
});

test("SAVE calls Phase 4B persistence only for event candidates", async () => {
  let writes = 0;
  const result = await runBollingerObservationBatch([
    { code: "7203", name: "event" }, { code: "6758", name: "none" },
  ], { limit: 2, mode: "SAVE", now,
    fetchBatch: async () => batch([{ code: "7203", dataset: crossDataset() },
      { code: "6758", dataset: dataset(Array.from({ length: 40 }, (_, i) => 100 + i * 0.1), {
        start: "2026-07-13", high: (close) => close + 0.1, low: (close) => close - 0.1 }) }]),
    persist: async (input) => { writes += 1; return { snapshotId: 1,
      snapshotCreated: true, eventsCreated: input.events.length }; },
  });
  assert.equal(writes, 1);
  assert.equal(result.snapshotsCreated, 1);
  assert.equal(result.noEventCount, 1);
});

test("fetch and persistence failures are isolated per symbol", async () => {
  const result = await runBollingerObservationBatch([
    { code: "7203", name: "fetch" }, { code: "6758", name: "persist" },
  ], { limit: 2, mode: "SAVE", now,
    fetchBatch: async () => batch([new Error("provider secret body"), { code: "6758", dataset: crossDataset() }]),
    persist: async () => { throw new Error("db secret body"); },
  });
  assert.equal(result.failedSymbols, 2);
  assert.deepEqual(result.errors.map((item) => item.reason), ["DAILY_FETCH_FAILED", "OBSERVATION_SAVE_FAILED"]);
});

test("duplicate stock codes are fetched once and limit/timeframe are guarded", async () => {
  let codes;
  await runBollingerObservationBatch([{ code: "7203", name: "a" }, { code: "7203", name: "b" }], {
    limit: 2, now, fetchBatch: async (input) => { codes = input; return batch([{ code: "7203", dataset: crossDataset() }]); },
  });
  assert.deepEqual(codes, ["7203"]);
  await assert.rejects(runBollingerObservationBatch([], { limit: 0 }), /INVALID_RUNNER_LIMIT/);
  await assert.rejects(runBollingerObservationBatch([{ code: "1", name: "x" }],
    { limit: 1, timeframe: "1W" }), /UNSUPPORTED_RUNNER_TIMEFRAME/);
});

function resultDataset(futureCount = 5) {
  const dates = ["2026-08-07", "2026-08-10", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-17"];
  const candles = dates.slice(0, futureCount + 1).map((date, index) => ({ time: time(date),
    open: 100 + index, high: 102 + index, low: 98 + index, close: 100 + index, volume: 1_000 + index }));
  return { timeframe: "1D", source: "YAHOO_CHART", range: "2y", interval: "1d",
    firstBarAt: new Date(candles[0].time * 1_000).toISOString(),
    lastBarAt: new Date(candles.at(-1).time * 1_000).toISOString(), candleCount: candles.length,
    status: "COMPLETE", complete: true, candles };
}
const event = (overrides = {}) => ({ eventId: 1, code: "7203", timeframe: "1D", side: "LOWER",
  sigmaLevel: 2, eventType: "CROSS", close: 100, observationDate: "2026-08-07",
  barEndAt: "2026-08-07T06:30:00Z", ...overrides });
const resultDatabase = { async query() { return { rows: [] }; }, async connect() { throw new Error("unused"); } };

test("future dataset requires the observation candle and returns actual later candles", () => {
  assert.equal(futureCandlesFromDataset(resultDataset(3), event(), now).length, 3);
  assert.throws(() => futureCandlesFromDataset(resultDataset(3),
    event({ observationDate: "2020-01-01" }), now), /MARKET_CALENDAR_UNAVAILABLE/);
});

test("result PREVIEW evaluates 0/1/3/5 candles without writes", async () => {
  for (const count of [0, 1, 3, 5]) {
    let writes = 0;
    const result = await runBollingerResultBatch({ limit: 1, mode: "PREVIEW", now,
      database: resultDatabase, selectEvents: async () => [event()],
      fetchBatch: async () => batch([{ code: "7203", dataset: resultDataset(count) }]),
      persist: async () => { writes += 1; return { created: 0, existing: 0 }; } });
    assert.equal(writes, 0);
    assert.equal(result.candidateResults, count === 0 ? 0 : count < 3 ? 1 : count < 5 ? 2 : 3);
  }
});

test("result SAVE reuses persistence and reports existing results", async () => {
  let horizons;
  const result = await runBollingerResultBatch({ limit: 1, mode: "SAVE", now,
    database: resultDatabase, selectEvents: async () => [event()],
    fetchBatch: async () => batch([{ code: "7203", dataset: resultDataset(5) }]),
    persist: async (inputs) => { horizons = inputs.map((item) => item.horizon); return { created: 1, existing: 2 }; } });
  assert.deepEqual(horizons, [1, 3, 5]);
  assert.equal(result.resultsCreated, 1);
  assert.equal(result.resultsExisting, 2);
});

test("canonical mismatch and per-event failures are visible and isolated", async () => {
  const result = await runBollingerResultBatch({ limit: 2, mode: "SAVE", now,
    database: resultDatabase, selectEvents: async () => [event(), event({ eventId: 2 })],
    fetchBatch: async () => batch([{ code: "7203", dataset: resultDataset(5) }]),
    persist: async (inputs) => { if (inputs[0].eventId === 1) throw new Error("CANONICAL_RESULT_MISMATCH:future_close");
      return { created: 3, existing: 0 }; } });
  assert.equal(result.failedEvents, 1);
  assert.equal(result.resultsCreated, 3);
  assert.equal(result.outcomes[0].reason, "CANONICAL_RESULT_MISMATCH:future_close");
});

test("result runner reports unavailable data, rejects weekly events, and validates limit", async () => {
  const result = await runBollingerResultBatch({ limit: 2, now, database: resultDatabase,
    selectEvents: async () => [event({ observationDate: "2026-01-05" }), event({ eventId: 2, timeframe: "1W" })],
    fetchBatch: async () => batch([{ code: "7203", dataset: resultDataset(5) }]) });
  assert.equal(result.unavailableEvents, 1);
  assert.equal(result.failedEvents, 1);
  await assert.rejects(runBollingerResultBatch({ limit: 101, database: resultDatabase }),
    /INVALID_RESULT_RUNNER_LIMIT/);
});

test("Phase 6 runners remain absent from Cron, production consumers, and UI", () => {
  for (const path of ["vercel.json", "app/lib/learning/pipeline.ts", "app/lib/bollingerBonus.ts",
    "app/api/ranking/route.ts", "app/api/cron/line/route.ts", "app/api/cron/line-ranking/route.ts",
    "app/learning/page.tsx", "app/result-stats/page.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /bollingerObservation(?:Result)?Runner/);
  }
});
