import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateBollingerObservation } from "../app/lib/technicalObservation/bollingerObservationMath.ts";
import { createBollingerObservationEvidence } from "../app/lib/technicalObservation/bollingerObservationEvidence.ts";
import {
  findCanonicalSnapshotMismatch,
  mapBollingerObservationSnapshot,
  normalizeDateOnly,
  saveBollingerObservation,
} from "../app/lib/technicalObservation/bollingerObservationPersistence.ts";

const MIGRATION = "scripts/migrations/20260822_create_technical_bb_observation.sql";

function candles(values, options = {}) {
  return values.map((close, index) => ({
    time: 1_800_000_000 + index * 86_400,
    open: close,
    high: close + (options.range ?? 1),
    low: close - (options.range ?? 1),
    close,
    volume: options.volume ?? 1_000,
  }));
}

function trend(count = 240) {
  return candles(Array.from({ length: count }, (_, index) => 100 + index * 0.2 + Math.sin(index / 3)));
}

function validInput(overrides = {}) {
  const inputCandles = trend();
  return {
    code: "7203",
    observationDate: "2026-08-21",
    timeframe: "1D",
    close: inputCandles.at(-1).close,
    calculation: calculateBollingerObservation(inputCandles.map((item) => item.close), "1D"),
    evidence: createBollingerObservationEvidence(inputCandles, "1D"),
    events: [
      { type: "TOUCH", side: "LOWER", sigmaLevel: 2 },
      { type: "CROSS", side: "LOWER", sigmaLevel: 2 },
    ],
    detectorVersion: "BB_OBSERVATION_V1",
    provider: "TEST",
    providerTimestamp: "2026-08-21T06:00:00.000Z",
    barStartAt: "2026-08-20T15:00:00.000Z",
    barEndAt: "2026-08-21T15:00:00.000Z",
    timezone: "Asia/Tokyo",
    metadata: { fixture: true },
    ...overrides,
  };
}

test("migration defines the three independent Phase 4B tables and idempotency keys", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  for (const table of ["snapshots", "events", "results"]) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.technical_bb_observation_${table}`));
  }
  assert.match(sql, /UNIQUE \(code, timeframe, bar_end_at, detector_version\)/);
  assert.match(sql, /UNIQUE \(snapshot_id, side, sigma_level, event_type\)/);
  assert.match(sql, /UNIQUE \(event_id, horizon, horizon_unit, result_version\)/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS/i);
});

test("migration enforces timeframe, period, event, horizon, metadata and MACD cross checks", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  assert.match(sql, /timeframe IN \('1D', '1W'\)/);
  assert.match(sql, /bb_period = 20/);
  assert.match(sql, /standard_deviation > 0/);
  assert.match(sql, /bar_start_at < bar_end_at/);
  assert.match(sql, /jsonb_typeof\(metadata\) = 'object'/);
  assert.match(sql, /macd_cross IN \('GOLDEN_CROSS', 'DEAD_CROSS'\)/);
  assert.match(sql, /sigma_level IN \(2, 3\)/);
  assert.match(sql, /'TOUCH', 'CROSS', 'CONTINUATION', 'RETURN_INSIDE'/);
  assert.match(sql, /horizon IN \(1, 3, 5\)/);
  assert.match(sql, /horizon_unit = 'TRADING_DAY'/);
});

test("migration enables RLS, revokes access and creates no policies or triggers", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length, 3);
  assert.match(sql, /FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON SEQUENCE/);
  assert.doesNotMatch(sql, /CREATE POLICY|CREATE TRIGGER/i);
  assert.doesNotMatch(sql, /\bbb_signal_(?:events|states|event_results)\b/);
  assert.doesNotMatch(sql, /\btechnical_signal_(?:events|states|event_results)\b/);
  assert.doesNotMatch(sql, /adjusted_return|rebounded|mean_reverted|\bwon\b|\blost\b/i);
});

test("ATR can be unavailable while RSI and MACD remain available", () => {
  const flat = candles(Array(40).fill(100), { range: 0 });
  const result = createBollingerObservationEvidence(flat, "1D");
  assert.equal(result.indicators.atr.availability, "UNAVAILABLE");
  assert.equal(result.indicators.rsi.availability, "AVAILABLE");
  assert.equal(result.indicators.macd.availability, "AVAILABLE");
  assert.equal(result.available, true);
});

test("indicator history requirements are independently represented", () => {
  const short = createBollingerObservationEvidence(trend(10), "1D");
  assert.equal(short.indicators.rsi.availability, "INSUFFICIENT_HISTORY");
  assert.equal(short.indicators.macd.availability, "INSUFFICIENT_HISTORY");
  assert.equal(short.indicators.ema.availability, "INSUFFICIENT_HISTORY");
  assert.equal(short.indicators.volumeRatio.availability, "INSUFFICIENT_HISTORY");
  const partial = createBollingerObservationEvidence(trend(75), "1D");
  assert.notEqual(partial.indicators.ema.value.ema20, null);
  assert.notEqual(partial.indicators.ema.value.ema75, null);
  assert.equal(partial.indicators.ema.value.ema200, null);
  assert.equal(partial.indicators.ema.availability, "INSUFFICIENT_HISTORY");
});

test("invalid, NaN and Infinity candles mark every indicator invalid", () => {
  for (const bad of [Number.NaN, Infinity]) {
    const input = trend(40); input[20] = { ...input[20], close: bad };
    const result = createBollingerObservationEvidence(input, "1D");
    assert.ok(Object.values(result.indicators).every((item) => item.availability === "INVALID"));
  }
});

test("BB adapter uses the shared MACD golden/dead cross classifier", () => {
  const base = Array.from({ length: 40 }, (_, index) => 100 + index * 0.5);
  const golden = [...base]; golden[39] += 0.5;
  const dead = [...base]; dead[39] -= 50;
  assert.equal(createBollingerObservationEvidence(candles(golden), "1D").macdCross, "GOLDEN_CROSS");
  assert.equal(createBollingerObservationEvidence(candles(dead), "1D").macdCross, "DEAD_CROSS");
});

test("pure snapshot mapping accepts a valid canonical observation", () => {
  const row = mapBollingerObservationSnapshot(validInput());
  assert.equal(row.code, "7203");
  assert.equal(row.detector_version, "BB_OBSERVATION_V1");
  assert.equal(row.bb_period, 20);
  assert.equal(row.rsi_availability, "AVAILABLE");
  assert.equal(findCanonicalSnapshotMismatch(row, row), null);
});

test("DATE canonicalization matches strings and node-postgres Date values without changing instants", () => {
  const expected = mapBollingerObservationSnapshot(validInput());
  assert.equal(normalizeDateOnly("2026-08-21"), "2026-08-21");
  assert.equal(normalizeDateOnly(new Date(2026, 7, 21)), "2026-08-21");
  assert.equal(findCanonicalSnapshotMismatch({ ...expected, observation_date: "2026-08-21" }, expected), null);
  assert.equal(findCanonicalSnapshotMismatch({ ...expected,
    observation_date: new Date(2026, 7, 21) }, expected), null);
  assert.equal(findCanonicalSnapshotMismatch({ ...expected,
    observation_date: new Date(2026, 7, 20) }, expected), "observation_date");
  assert.equal(findCanonicalSnapshotMismatch({ ...expected,
    observation_date: new Date(2026, 7, 21), close: expected.close + 1 }, expected), "close");
  assert.equal(findCanonicalSnapshotMismatch({ ...expected,
    observation_date: new Date(2026, 7, 21), bar_end_at: new Date(expected.bar_end_at) }, expected), null);
  assert.equal(findCanonicalSnapshotMismatch({ ...expected,
    observation_date: "not-a-date" }, expected), "observation_date");
  assert.equal(normalizeDateOnly("2026-02-30"), null);
});

test("snapshot validation rejects invalid canonical inputs", () => {
  const cases = [
    ["INVALID_CODE", { code: " " }],
    ["INVALID_TIMEFRAME", { timeframe: "5M" }],
    ["INVALID_CLOSE", { close: 0 }],
    ["INVALID_CLOSE", { close: Number.NaN }],
    ["INVALID_CLOSE", { close: Infinity }],
    ["INVALID_BAR_RANGE", { barStartAt: "2026-08-21T15:00:00Z" }],
  ];
  for (const [message, overrides] of cases) {
    assert.throws(() => mapBollingerObservationSnapshot(validInput(overrides)), new RegExp(message));
  }
  const zero = validInput();
  zero.calculation = { ...zero.calculation, reason: "ZERO_DEVIATION", standardDeviation: 0 };
  assert.throws(() => mapBollingerObservationSnapshot(zero), /INVALID_BOLLINGER_CALCULATION/);
});

test("AVAILABLE evidence requires finite values", () => {
  const missing = validInput();
  missing.evidence = structuredClone(missing.evidence);
  missing.evidence.indicators.rsi.value = null;
  assert.throws(() => mapBollingerObservationSnapshot(missing), /AVAILABLE_RSI_MISSING/);
  const nonFinite = validInput();
  nonFinite.evidence = structuredClone(nonFinite.evidence);
  nonFinite.evidence.indicators.macd.value.histogram = Infinity;
  assert.throws(() => mapBollingerObservationSnapshot(nonFinite), /INVALID_MACD/);
});

function mockDatabase(expectedRow, options = {}) {
  const state = { row: options.existing ? { id: 1, ...expectedRow } : null,
    eventKeys: new Set(options.existingEvents ?? []), queries: [], released: false };
  const client = {
    async query(sql) {
      const values = arguments[1] ?? [];
      state.queries.push(String(sql).trim());
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [], rowCount: null };
      if (String(sql).startsWith("SELECT id,")) return { rows: state.row ? [state.row] : [], rowCount: state.row ? 1 : 0 };
      if (String(sql).includes("INSERT INTO technical_bb_observation_snapshots")) {
        if (state.row) return { rows: [], rowCount: 0 };
        state.row = { id: 1, ...expectedRow }; return { rows: [{ id: 1 }], rowCount: 1 };
      }
      if (String(sql).includes("INSERT INTO technical_bb_observation_events")) {
        if (options.failEvent) throw new Error("EVENT_FAILURE");
        const key = `${values[1]}:${values[2]}:${values[3]}`;
        if (state.eventKeys.has(key)) return { rows: [], rowCount: 0 };
        state.eventKeys.add(key); return { rows: [], rowCount: 1 };
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    },
    release() { state.released = true; },
  };
  return { state, database: { async connect() { return client; } } };
}

test("first persistence inserts one snapshot and its events in one transaction", async () => {
  const input = validInput(); const expected = mapBollingerObservationSnapshot(input);
  const mock = mockDatabase(expected);
  const result = await saveBollingerObservation(input, mock.database);
  assert.deepEqual(result, { snapshotId: 1, snapshotCreated: true, eventsCreated: 2 });
  assert.equal(mock.state.queries[0], "BEGIN");
  assert.equal(mock.state.queries.at(-1), "COMMIT");
  assert.equal(mock.state.released, true);
});

test("same snapshot and duplicate events are idempotent", async () => {
  const input = validInput(); const expected = mapBollingerObservationSnapshot(input);
  const mock = mockDatabase({ ...expected,
    observation_date: new Date(2026, 7, 21) }, { existing: true,
    existingEvents: ["LOWER:2:TOUCH", "LOWER:2:CROSS"] });
  const result = await saveBollingerObservation(input, mock.database);
  assert.deepEqual(result, { snapshotId: 1, snapshotCreated: false, eventsCreated: 0 });
  assert.equal(mock.state.queries.some((sql) => sql.startsWith("UPDATE")), false);
});

test("canonical mismatch is explicit and never silently overwritten", async () => {
  const input = validInput(); const expected = mapBollingerObservationSnapshot(input);
  const mock = mockDatabase({ ...expected, close: expected.close + 1 }, { existing: true });
  await assert.rejects(saveBollingerObservation(input, mock.database), /CANONICAL_SNAPSHOT_MISMATCH:close/);
  assert.equal(mock.state.queries.at(-1), "ROLLBACK");
  assert.equal(mock.state.queries.some((sql) => sql.startsWith("UPDATE")), false);
});

test("event failure rolls back the snapshot/event transaction", async () => {
  const input = validInput(); const expected = mapBollingerObservationSnapshot(input);
  const mock = mockDatabase(expected, { failEvent: true });
  await assert.rejects(saveBollingerObservation(input, mock.database), /EVENT_FAILURE/);
  assert.equal(mock.state.queries.at(-1), "ROLLBACK");
  assert.equal(mock.state.queries.includes("COMMIT"), false);
  assert.equal(mock.state.released, true);
});

test("new persistence remains detached from protected production consumers", () => {
  const moduleName = /bollingerObservationPersistence/;
  for (const file of ["app/lib/learning/pipeline.ts", "app/lib/bollingerBonus.ts",
    "app/lib/aiEngine.ts", "app/api/ranking/route.ts",
    "app/api/cron/line/route.ts", "app/api/cron/line-ranking/route.ts"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), moduleName);
  }
  const source = readFileSync("app/lib/technicalObservation/bollingerObservationPersistence.ts", "utf8");
  assert.doesNotMatch(source, /daily_stock_results|bb_signal_events|technical_signal_events|notification|sendLine/i);
});
