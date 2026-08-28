import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateBollingerObservationStatistics,
  validateBollingerStatisticsFilter,
} from "../app/lib/technicalObservation/bollingerObservationStatistics.ts";
import {
  buildBollingerStatisticsQuery,
  getBollingerObservationStatistics,
} from "../app/lib/technicalObservation/bollingerObservationStatisticsRepository.ts";

const filter = (overrides = {}) => ({
  timeframe: "1D", side: "LOWER", sigmaLevel: 2, eventType: "CROSS", horizon: 3,
  detectorVersion: "BB_OBSERVATION_V1", resultVersion: "BB_OBSERVATION_RESULT_V1",
  ...overrides,
});
const rows = () => [
  { eventId: 1, rawReturn: 5, maxRise: 7, maxDrawdown: -1 },
  { eventId: 2, rawReturn: -2, maxRise: 2, maxDrawdown: -4 },
  { eventId: 3, rawReturn: 0, maxRise: 1, maxDrawdown: 1 },
  { eventId: 4, rawReturn: null, maxRise: null, maxDrawdown: null },
];

test("empty and pending-only samples retain event counts without invented returns", () => {
  const empty = calculateBollingerObservationStatistics(filter(), []);
  assert.deepEqual({ sample: empty.sampleCount, complete: empty.completedSampleCount,
    pending: empty.pendingSampleCount, winRate: empty.winRate, average: empty.averageRawReturn },
  { sample: 0, complete: 0, pending: 0, winRate: null, average: null });
  const pending = calculateBollingerObservationStatistics(filter(), [
    { eventId: 1, rawReturn: null, maxRise: null, maxDrawdown: null },
  ]);
  assert.equal(pending.sampleCount, 1);
  assert.equal(pending.completedSampleCount, 0);
  assert.equal(pending.pendingSampleCount, 1);
});

test("WIN LOSS NEUTRAL and winRate exclude neutral and pending samples", () => {
  const stats = calculateBollingerObservationStatistics(filter(), rows());
  assert.equal(stats.sampleCount, 4);
  assert.equal(stats.completedSampleCount, 3);
  assert.equal(stats.pendingSampleCount, 1);
  assert.equal(stats.winCount, 1);
  assert.equal(stats.lossCount, 1);
  assert.equal(stats.neutralCount, 1);
  assert.equal(stats.winRate, 50);
});

test("LOWER preserves raw direction and computes averages, medians, extrema and excursions", () => {
  const stats = calculateBollingerObservationStatistics(filter(), rows());
  assert.equal(stats.averageRawReturn, 1);
  assert.equal(stats.medianRawReturn, 0);
  assert.equal(stats.averageAdjustedReturn, 1);
  assert.equal(stats.medianAdjustedReturn, 0);
  assert.equal(stats.minAdjustedReturn, -2);
  assert.equal(stats.maxAdjustedReturn, 5);
  assert.equal(stats.averageMaxRise, 10 / 3);
  assert.equal(stats.averageMaxDrawdown, -4 / 3);
  assert.equal(stats.worstMaxDrawdown, -4);
});

test("UPPER reverses adjusted returns without losing raw returns", () => {
  const stats = calculateBollingerObservationStatistics(filter({ side: "UPPER" }), rows());
  assert.equal(stats.averageRawReturn, 1);
  assert.equal(stats.medianRawReturn, 0);
  assert.equal(stats.averageAdjustedReturn, -1);
  assert.equal(stats.medianAdjustedReturn, 0);
  assert.equal(stats.minAdjustedReturn, -5);
  assert.equal(stats.maxAdjustedReturn, 2);
  assert.equal(stats.winCount, 1);
  assert.equal(stats.lossCount, 1);
});

test("median is correct for odd, even, negative and positive samples", () => {
  const odd = calculateBollingerObservationStatistics(filter(), rows().slice(0, 3));
  assert.equal(odd.medianRawReturn, 0);
  const even = calculateBollingerObservationStatistics(filter(), [
    { eventId: 1, rawReturn: -4, maxRise: 1, maxDrawdown: -5 },
    { eventId: 2, rawReturn: 2, maxRise: 3, maxDrawdown: -1 },
  ]);
  assert.equal(even.medianRawReturn, -1);
});

test("zero directional denominator returns null winRate", () => {
  const stats = calculateBollingerObservationStatistics(filter(), [
    { eventId: 1, rawReturn: 0, maxRise: 1, maxDrawdown: 0 },
  ]);
  assert.equal(stats.winRate, null);
  assert.equal(stats.neutralCount, 1);
});

test("duplicate event rows and partial result rows fail closed", () => {
  assert.throws(() => calculateBollingerObservationStatistics(filter(), [rows()[0], rows()[0]]),
    /DUPLICATE_EVENT_ROW/);
  assert.throws(() => calculateBollingerObservationStatistics(filter(), [
    { eventId: 1, rawReturn: 1, maxRise: null, maxDrawdown: -1 },
  ]), /PARTIAL_STATISTICS_RESULT_ROW/);
});

test("SMALL_SAMPLE appears only with a caller-supplied threshold", () => {
  assert.deepEqual(calculateBollingerObservationStatistics(filter(), rows()).warnings, []);
  assert.deepEqual(calculateBollingerObservationStatistics(
    filter({ minimumSampleThreshold: 4 }), rows()).warnings, ["SMALL_SAMPLE"]);
});

test("query starts from events and LEFT JOINs one COMPLETE horizon/version result", () => {
  const query = buildBollingerStatisticsQuery(filter());
  assert.match(query.text, /FROM technical_bb_observation_events e/);
  assert.match(query.text, /JOIN technical_bb_observation_snapshots s/);
  assert.match(query.text, /LEFT JOIN technical_bb_observation_results r/);
  assert.match(query.text, /r\.result_quality = 'COMPLETE'/);
  assert.match(query.text, /r\.horizon = \$6/);
  assert.deepEqual(query.values, ["1D", "LOWER", 2, "CROSS", "BB_OBSERVATION_V1", 3,
    "BB_OBSERVATION_RESULT_V1"]);
  assert.doesNotMatch(query.text, /INSERT|UPDATE|DELETE|UPSERT/i);
});

test("date, code, RSI, MACD, EMA and volume filters are parameterized with availability", () => {
  const query = buildBollingerStatisticsQuery(filter({
    fromDate: "2026-01-01", toDate: "2026-12-31", code: "7203", rsiMin: 20, rsiMax: 30,
    macdCross: "GOLDEN_CROSS", macdHistogramMin: 0, ema20Min: 100, ema200Max: 500,
    volumeRatioMin: 1.5, volumeRatioMax: 3,
  }));
  assert.match(query.text, /s\.observation_date >= \$/);
  assert.match(query.text, /s\.code = \$/);
  assert.match(query.text, /s\.rsi_availability = 'AVAILABLE'/);
  assert.match(query.text, /s\.macd_availability = 'AVAILABLE'/);
  assert.match(query.text, /s\.ema_availability = 'AVAILABLE'/);
  assert.match(query.text, /s\.volume_ratio_availability = 'AVAILABLE'/);
  assert.doesNotMatch(query.text, /7203|GOLDEN_CROSS|2026-01-01|1\.5/);
  assert.ok(query.values.includes("7203"));
  assert.ok(query.values.includes("GOLDEN_CROSS"));
});

test("side, sigma, event type, horizon and versions remain separate query parameters", () => {
  const first = buildBollingerStatisticsQuery(filter());
  const second = buildBollingerStatisticsQuery(filter({ side: "UPPER", sigmaLevel: 3,
    eventType: "TOUCH", horizon: 5 }));
  assert.notDeepEqual(first.values, second.values);
  assert.ok(second.values.includes("UPPER"));
  assert.ok(second.values.includes(3));
  assert.ok(second.values.includes("TOUCH"));
  assert.ok(second.values.includes(5));
});

test("repository converts DB numeric strings and preserves pending rows", async () => {
  const database = { async query(sql, values) {
    assert.match(sql, /^SELECT/); assert.ok(values.length > 0);
    return { rows: [
      { event_id: "1", return_percent: "5", max_rise_percent: "7", max_drawdown_percent: "-2" },
      { event_id: "2", return_percent: null, max_rise_percent: null, max_drawdown_percent: null },
    ] };
  } };
  const stats = await getBollingerObservationStatistics(filter(), database);
  assert.equal(stats.sampleCount, 2);
  assert.equal(stats.completedSampleCount, 1);
  assert.equal(stats.pendingSampleCount, 1);
  assert.equal(stats.averageRawReturn, 5);
});

test("filter validation rejects unsafe dimensions, dates, ranges and values", () => {
  const cases = [
    ["UNSUPPORTED_STATISTICS_TIMEFRAME", { timeframe: "1W" }],
    ["INVALID_STATISTICS_SIDE", { side: "BOTH" }],
    ["INVALID_STATISTICS_SIGMA_LEVEL", { sigmaLevel: 1 }],
    ["INVALID_STATISTICS_EVENT_TYPE", { eventType: "ALL" }],
    ["INVALID_STATISTICS_HORIZON", { horizon: 2 }],
    ["INVALID_STATISTICS_DETECTOR_VERSION", { detectorVersion: "V2" }],
    ["INVALID_STATISTICS_RESULT_VERSION", { resultVersion: "V2" }],
    ["INVALID_FROM_DATE", { fromDate: "bad" }],
    ["INVALID_DATE_RANGE", { fromDate: "2026-02-01", toDate: "2026-01-01" }],
    ["INVALID_STATISTICS_CODE", { code: " " }],
    ["INVALID_STATISTICS_FILTER:rsiMin", { rsiMin: Number.NaN }],
    ["INVALID_STATISTICS_FILTER:volumeRatioMax", { volumeRatioMax: Infinity }],
    ["INVALID_STATISTICS_RANGE:rsiMin", { rsiMin: 50, rsiMax: 20 }],
  ];
  for (const [message, overrides] of cases) {
    assert.throws(() => validateBollingerStatisticsFilter(filter(overrides)), new RegExp(message));
  }
});

test("Phase 5 repository is SELECT-only and detached from production consumers", () => {
  const source = readFileSync("app/lib/technicalObservation/bollingerObservationStatisticsRepository.ts", "utf8");
  assert.doesNotMatch(source, /INSERT INTO|UPDATE\s+technical|DELETE FROM|UPSERT/i);
  for (const path of ["app/lib/learning/pipeline.ts", "app/lib/bollingerBonus.ts",
    "app/api/ranking/route.ts", "app/api/cron/line/route.ts", "app/api/cron/line-ranking/route.ts"]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /bollingerObservationStatistics/);
  }
});
