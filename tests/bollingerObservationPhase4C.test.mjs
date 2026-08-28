import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  evaluateBollingerObservationFuture,
  resultsForBollingerEvent,
} from "../app/lib/technicalObservation/bollingerObservationResultEvaluator.ts";
import {
  findCanonicalResultMismatch,
  saveBollingerObservationResults,
} from "../app/lib/technicalObservation/bollingerObservationResultPersistence.ts";

const snapshot = (overrides = {}) => ({
  timeframe: "1D", close: 100, observationDate: "2026-08-07",
  barEndAt: "2026-08-07T06:00:00.000Z", ...overrides,
});
const candle = (tradeDate, open, high, low, close) => ({ tradeDate, open, high, low, close });
const five = () => [
  candle("2026-08-10", 100, 103, 98, 102),
  candle("2026-08-11", 102, 108, 101, 106),
  candle("2026-08-12", 106, 107, 95, 96),
  candle("2026-08-14", 96, 101, 94, 99),
  candle("2026-08-17", 99, 110, 97, 105),
];

test("1/3/5 trading-candle horizons calculate raw return and window extrema", () => {
  const result = evaluateBollingerObservationFuture(snapshot(), five());
  assert.deepEqual(result.notYetEvaluable, []);
  assert.deepEqual(result.completed.map((item) => item.horizon), [1, 3, 5]);
  assert.deepEqual(result.completed[0], {
    horizon: 1, horizonUnit: "TRADING_DAY", entryPrice: 100, futureClose: 102,
    returnPercent: 2, maxRisePercent: 3, maxDrawdownPercent: -2,
    maxRiseTradeDate: "2026-08-10", maxDrawdownTradeDate: "2026-08-10",
    evaluatedTradeDate: "2026-08-10", windowCandleCount: 1,
    resultQuality: "COMPLETE", resultVersion: "BB_OBSERVATION_RESULT_V1",
  });
  assert.equal(result.completed[1].futureClose, 96);
  assert.equal(result.completed[1].returnPercent, -4);
  assert.equal(result.completed[1].maxRisePercent, 8);
  assert.equal(result.completed[1].maxRiseTradeDate, "2026-08-11");
  assert.equal(result.completed[1].maxDrawdownPercent, -5);
  assert.equal(result.completed[1].maxDrawdownTradeDate, "2026-08-12");
  assert.equal(result.completed[2].returnPercent, 5);
  assert.equal(result.completed[2].maxRisePercent, 10);
  assert.equal(result.completed[2].maxDrawdownPercent, -6);
});

test("one-day formal example produces 3, 5, and -3 percent", () => {
  const result = evaluateBollingerObservationFuture(snapshot(), [
    candle("2026-08-10", 100, 105, 97, 103),
  ]).completed[0];
  assert.equal(result.returnPercent, 3);
  assert.equal(result.maxRisePercent, 5);
  assert.equal(result.maxDrawdownPercent, -3);
});

test("ties select the first candle and positive drawdown is not clipped", () => {
  const result = evaluateBollingerObservationFuture(snapshot(), [
    candle("2026-08-10", 102, 108, 101, 104),
    candle("2026-08-11", 104, 108, 101, 105),
    candle("2026-08-12", 105, 107, 103, 106),
  ]).completed[1];
  assert.equal(result.maxRiseTradeDate, "2026-08-10");
  assert.equal(result.maxDrawdownTradeDate, "2026-08-10");
  assert.equal(result.maxDrawdownPercent, 1);
});

test("LOWER and UPPER events map the same raw metrics", () => {
  const evaluation = evaluateBollingerObservationFuture(snapshot(), five());
  const lower = resultsForBollingerEvent({ eventId: 1, side: "LOWER", sigmaLevel: 2, eventType: "CROSS" }, evaluation);
  const upper = resultsForBollingerEvent({ eventId: 2, side: "UPPER", sigmaLevel: 3, eventType: "TOUCH" }, evaluation);
  assert.deepEqual(lower.map(({ eventId, ...item }) => item), upper.map(({ eventId, ...item }) => item));
});

test("0 through 5 candles expose only completed horizons", () => {
  const expected = [[], [1], [1], [1, 3], [1, 3], [1, 3, 5]];
  for (let count = 0; count <= 5; count += 1) {
    const result = evaluateBollingerObservationFuture(snapshot(), five().slice(0, count));
    assert.deepEqual(result.completed.map((item) => item.horizon), expected[count]);
    assert.deepEqual([...result.completed.map((item) => item.horizon), ...result.notYetEvaluable], [1, 3, 5]);
  }
});

test("more than five candles are ignored after the required window", () => {
  const input = [...five(), candle("2026-08-18", 105, 999, 1, 500)];
  const result = evaluateBollingerObservationFuture(snapshot(), input).completed.at(-1);
  assert.equal(result.futureClose, 105);
  assert.equal(result.maxRisePercent, 10);
  assert.equal(result.maxDrawdownPercent, -6);
});

test("weekends and holiday gaps are counted only by actual sorted candles", () => {
  const descending = [...five()].reverse();
  const result = evaluateBollingerObservationFuture(snapshot(), descending);
  assert.equal(result.completed[0].evaluatedTradeDate, "2026-08-10");
  assert.equal(result.completed[1].evaluatedTradeDate, "2026-08-12");
  assert.equal(result.completed[2].evaluatedTradeDate, "2026-08-17");
});

test("invalid OHLC, non-finite values, duplicates, and non-future dates fail closed", () => {
  const invalid = [
    [candle("2026-08-10", 100, 90, 95, 100), "INVALID_FUTURE_CANDLE"],
    [candle("2026-08-10", 100, Infinity, 95, 100), "INVALID_FUTURE_CANDLE"],
    [candle("2026-08-10", 100, 105, 95, Number.NaN), "INVALID_FUTURE_CANDLE"],
    [[candle("2026-08-10", 100, 105, 95, 100), candle("2026-08-10", 100, 105, 95, 100)], "DUPLICATE_FUTURE_TRADE_DATE"],
    [candle("2026-08-07", 100, 105, 95, 100), "FUTURE_CANDLE_NOT_AFTER_OBSERVATION"],
    [candle("bad-date", 100, 105, 95, 100), "INVALID_FUTURE_TRADE_DATE"],
  ];
  for (const [value, message] of invalid) {
    const candles = Array.isArray(value) ? value : [value];
    assert.throws(() => evaluateBollingerObservationFuture(snapshot(), candles), new RegExp(message));
  }
});

test("weekly snapshots are explicitly rejected", () => {
  assert.throws(() => evaluateBollingerObservationFuture(snapshot({ timeframe: "1W" }), five()),
    /UNSUPPORTED_RESULT_TIMEFRAME/);
});

function persisted(eventId = 9) {
  return resultsForBollingerEvent(
    { eventId, side: "LOWER", sigmaLevel: 2, eventType: "CROSS" },
    evaluateBollingerObservationFuture(snapshot(), five()),
  );
}

function databaseFixture(options = {}) {
  const rows = new Map(); const queries = [];
  for (const row of options.rows ?? []) rows.set(Number(row.horizon), row);
  const client = {
    async query(sql, values = []) {
      queries.push(String(sql).trim());
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: null };
      if (String(sql).startsWith("SELECT id,")) {
        const row = rows.get(values[1]); return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (String(sql).includes("INSERT INTO technical_bb_observation_results")) {
        if (options.failHorizon === values[1]) throw new Error("RESULT_INSERT_FAILURE");
        if (rows.has(values[1])) return { rows: [], rowCount: 0 };
        rows.set(values[1], { id: values[1], event_id: values[0], horizon: values[1],
          horizon_unit: values[2], entry_price: String(values[3]), future_close: String(values[4]),
          return_percent: String(values[5]), max_rise_percent: String(values[6]),
          max_drawdown_percent: String(values[7]), max_rise_trade_date: new Date(`${values[8]}T00:00:00`),
          max_drawdown_trade_date: new Date(`${values[9]}T00:00:00`),
          evaluated_trade_date: new Date(`${values[10]}T00:00:00`), window_candle_count: values[11],
          result_quality: values[12], result_version: values[13] });
        return { rows: [{ id: values[1] }], rowCount: 1 };
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    }, release() {},
  };
  return { rows, queries, database: { async connect() { return client; } } };
}

test("first persistence inserts 1/3/5 results in one transaction", async () => {
  const db = databaseFixture();
  assert.deepEqual(await saveBollingerObservationResults(persisted(), { database: db.database,
    evaluatedAt: new Date("2026-08-20T00:00:00Z") }), { created: 3, existing: 0 });
  assert.equal(db.queries[0], "BEGIN");
  assert.equal(db.queries.at(-1), "COMMIT");
  assert.deepEqual([...db.rows.keys()], [1, 3, 5]);
});

test("numeric strings and DATE objects are canonical idempotent matches", async () => {
  const first = persisted()[0];
  const row = { id: 1, event_id: String(first.eventId), horizon: String(first.horizon),
    horizon_unit: first.horizonUnit, entry_price: String(first.entryPrice), future_close: String(first.futureClose),
    return_percent: String(first.returnPercent), max_rise_percent: String(first.maxRisePercent),
    max_drawdown_percent: String(first.maxDrawdownPercent), max_rise_trade_date: new Date(2026, 7, 10),
    max_drawdown_trade_date: new Date(2026, 7, 10), evaluated_trade_date: new Date(2026, 7, 10),
    window_candle_count: String(first.windowCandleCount), result_quality: "COMPLETE",
    result_version: "BB_OBSERVATION_RESULT_V1" };
  assert.equal(findCanonicalResultMismatch(row, first), null);
  const db = databaseFixture({ rows: [row] });
  assert.deepEqual(await saveBollingerObservationResults([first], { database: db.database }),
    { created: 0, existing: 1 });
});

test("canonical future close and return mismatches are explicit with no UPDATE", async () => {
  const input = persisted()[0];
  for (const column of ["future_close", "return_percent"]) {
    const expected = { ...input };
    const row = { id: 1, event_id: input.eventId, horizon: input.horizon,
      horizon_unit: input.horizonUnit, entry_price: input.entryPrice, future_close: input.futureClose,
      return_percent: input.returnPercent, max_rise_percent: input.maxRisePercent,
      max_drawdown_percent: input.maxDrawdownPercent, max_rise_trade_date: input.maxRiseTradeDate,
      max_drawdown_trade_date: input.maxDrawdownTradeDate, evaluated_trade_date: input.evaluatedTradeDate,
      window_candle_count: input.windowCandleCount, result_quality: input.resultQuality,
      result_version: input.resultVersion, [column]: input[column === "future_close" ? "futureClose" : "returnPercent"] + 1 };
    const db = databaseFixture({ rows: [row] });
    await assert.rejects(saveBollingerObservationResults([expected], { database: db.database }),
      new RegExp(`CANONICAL_RESULT_MISMATCH:${column}`));
    assert.equal(db.queries.at(-1), "ROLLBACK");
    assert.equal(db.queries.some((sql) => /^UPDATE\b/i.test(sql)), false);
  }
});

test("incomplete horizons never reach persistence", async () => {
  const evaluation = evaluateBollingerObservationFuture(snapshot(), five().slice(0, 2));
  const inputs = resultsForBollingerEvent({ eventId: 9, side: "LOWER", sigmaLevel: 2, eventType: "CROSS" }, evaluation);
  const db = databaseFixture();
  assert.deepEqual(inputs.map((item) => item.horizon), [1]);
  assert.deepEqual(await saveBollingerObservationResults(inputs, { database: db.database }),
    { created: 1, existing: 0 });
  assert.deepEqual([...db.rows.keys()], [1]);
});

test("mid-batch insert failure rolls back the event result transaction", async () => {
  const db = databaseFixture({ failHorizon: 3 });
  await assert.rejects(saveBollingerObservationResults(persisted(), { database: db.database }),
    /RESULT_INSERT_FAILURE/);
  assert.equal(db.queries.at(-1), "ROLLBACK");
});

test("Phase 4C remains detached and stores no adjusted or boolean outcomes", () => {
  const evaluator = readFileSync("app/lib/technicalObservation/bollingerObservationResultEvaluator.ts", "utf8");
  const persistence = readFileSync("app/lib/technicalObservation/bollingerObservationResultPersistence.ts", "utf8");
  assert.doesNotMatch(`${evaluator}\n${persistence}`, /adjustedReturn|rebounded|meanReverted|\bwon\b|\blost\b/);
  for (const path of ["app/lib/learning/pipeline.ts", "app/lib/bollingerBonus.ts",
    "app/api/ranking/route.ts", "app/api/cron/line/route.ts", "app/api/cron/line-ranking/route.ts"]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /bollingerObservationResult(?:Evaluator|Persistence)/);
  }
});
