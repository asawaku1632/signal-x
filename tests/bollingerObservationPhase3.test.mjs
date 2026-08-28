import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  adjustBollingerReturn,
  calculateBbSigmaPosition,
  calculateBollingerObservation,
  classifyAdjustedReturn,
} from "../app/lib/technicalObservation/bollingerObservationMath.ts";
import { detectBollingerObservationEvents } from "../app/lib/technicalObservation/bollingerObservationDetector.ts";
import {
  adaptMacdCrossStatus,
  createBollingerObservationEvidence,
} from "../app/lib/technicalObservation/bollingerObservationEvidence.ts";
import { BOLLINGER_OBSERVATION_TIMEFRAMES } from "../app/lib/technicalObservation/bollingerObservationTypes.ts";

function has(events, type, side, sigmaLevel) {
  return events.some((event) => event.type === type && event.side === side && event.sigmaLevel === sigmaLevel);
}

const bands = { lower2: 80, lower3: 70, upper2: 120, upper3: 130 };
const candle = (close, { low = close, high = close } = {}) => ({ close, low, high });

test("period-20 BB uses SMA, population deviation, and unrounded 1/2/3 sigma bands", () => {
  const closes = Array.from({ length: 20 }, (_, index) => index + 1);
  const result = calculateBollingerObservation(closes, "1D");
  const deviation = Math.sqrt(33.25);
  assert.equal(result.period, 20);
  assert.equal(result.bbMiddle, 10.5);
  assert.equal(result.standardDeviation, deviation);
  assert.equal(result.bbUpper1, 10.5 + deviation);
  assert.equal(result.bbUpper2, 10.5 + deviation * 2);
  assert.equal(result.bbUpper3, 10.5 + deviation * 3);
  assert.equal(result.bbLower1, 10.5 - deviation);
  assert.equal(result.bbLower2, 10.5 - deviation * 2);
  assert.equal(result.bbLower3, 10.5 - deviation * 3);
  assert.equal(result.bbSigmaPosition, (20 - 10.5) / deviation);
  assert.equal(result.reason, null);
});

test("bbSigmaPosition preserves exact continuous sigma coordinates", () => {
  for (const sigma of [0, 1, -1, 2, -2, 3, -3, 0.375]) {
    assert.deepEqual(calculateBbSigmaPosition(100 + sigma * 4, 100, 4), { value: sigma, reason: null });
  }
});

test("bbSigmaPosition and BB calculation fail closed with quality reasons", () => {
  assert.deepEqual(calculateBbSigmaPosition(100, 100, 0), { value: null, reason: "ZERO_DEVIATION" });
  assert.equal(calculateBbSigmaPosition(null, 100, 2).reason, "NON_FINITE_INPUT");
  assert.equal(calculateBbSigmaPosition(Number.NaN, 100, 2).reason, "NON_FINITE_INPUT");
  assert.equal(calculateBbSigmaPosition(Infinity, 100, 2).reason, "NON_FINITE_INPUT");
  assert.equal(calculateBbSigmaPosition(0, 100, 2).reason, "INVALID_PRICE");
  assert.equal(calculateBollingerObservation(Array(19).fill(100), "1D").reason, "INSUFFICIENT_HISTORY");
  assert.equal(calculateBollingerObservation([...Array(19).fill(100), null], "1D").reason, "NON_FINITE_INPUT");
  const flat = calculateBollingerObservation(Array(20).fill(100), "1D");
  assert.equal(flat.standardDeviation, 0);
  assert.equal(flat.bbSigmaPosition, null);
  assert.equal(flat.reason, "ZERO_DEVIATION");
});

test("TOUCH detects lower/upper 2 and 3 sigma without fabricating CROSS", () => {
  const lower = detectBollingerObservationEvents({ current: candle(100, { low: 69, high: 101 }), currentBands: bands,
    previous: candle(100), previousBands: bands });
  assert.ok(has(lower, "TOUCH", "LOWER", 2));
  assert.ok(has(lower, "TOUCH", "LOWER", 3));
  assert.equal(lower.some((event) => event.type === "CROSS"), false);
  const upper = detectBollingerObservationEvents({ current: candle(100, { low: 99, high: 131 }), currentBands: bands,
    previous: candle(100), previousBands: bands });
  assert.ok(has(upper, "TOUCH", "UPPER", 2));
  assert.ok(has(upper, "TOUCH", "UPPER", 3));
  assert.equal(upper.some((event) => event.type === "CROSS"), false);
});

test("CROSS is threshold-independent and includes equality at 2/3 sigma", () => {
  const lower = detectBollingerObservationEvents({ current: candle(70), currentBands: bands,
    previous: candle(100), previousBands: bands });
  assert.ok(has(lower, "CROSS", "LOWER", 2));
  assert.ok(has(lower, "CROSS", "LOWER", 3));
  const upper = detectBollingerObservationEvents({ current: candle(130), currentBands: bands,
    previous: candle(100), previousBands: bands });
  assert.ok(has(upper, "CROSS", "UPPER", 2));
  assert.ok(has(upper, "CROSS", "UPPER", 3));
});

test("CONTINUATION and RETURN_INSIDE retain side and sigma level", () => {
  const lowerContinuation = detectBollingerObservationEvents({ current: candle(79), currentBands: bands,
    previous: candle(80), previousBands: bands });
  assert.ok(has(lowerContinuation, "CONTINUATION", "LOWER", 2));
  const upperContinuation = detectBollingerObservationEvents({ current: candle(121), currentBands: bands,
    previous: candle(120), previousBands: bands });
  assert.ok(has(upperContinuation, "CONTINUATION", "UPPER", 2));
  const lowerReturn = detectBollingerObservationEvents({ current: candle(81), currentBands: bands,
    previous: candle(80), previousBands: bands });
  assert.ok(has(lowerReturn, "RETURN_INSIDE", "LOWER", 2));
  const upperReturn = detectBollingerObservationEvents({ current: candle(119), currentBands: bands,
    previous: candle(120), previousBands: bands });
  assert.ok(has(upperReturn, "RETURN_INSIDE", "UPPER", 2));
});

test("missing previous candle permits TOUCH only", () => {
  const events = detectBollingerObservationEvents({ current: candle(70), currentBands: bands });
  assert.ok(has(events, "TOUCH", "LOWER", 2) && has(events, "TOUCH", "LOWER", 3));
  assert.equal(events.some((event) => event.type !== "TOUCH"), false);
});

test("daily and weekly observation ownership remains explicit and distinct", () => {
  assert.deepEqual(BOLLINGER_OBSERVATION_TIMEFRAMES, ["1D", "1W"]);
  const values = Array.from({ length: 20 }, (_, index) => 100 + index);
  assert.equal(calculateBollingerObservation(values, "1D").timeframe, "1D");
  assert.equal(calculateBollingerObservation(values, "1W").timeframe, "1W");
});

test("adjusted returns encode lower-up and upper-down mean-reversion direction", () => {
  assert.equal(adjustBollingerReturn("LOWER", 0.05), 0.05);
  assert.equal(adjustBollingerReturn("UPPER", 0.05), -0.05);
  assert.equal(classifyAdjustedReturn(0), "NEUTRAL");
});

function trend(count) {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.2 + Math.sin(index / 3);
    return { time: 1_800_000_000 + index * 86_400, open: close - 0.2, high: close + 1,
      low: close - 1, close, volume: index === count - 1 ? 2_000 : 1_000 };
  });
}

test("Evidence adapter reuses RSI, MACD/signal/histogram, EMA, ATR, and volume ratio evidence", () => {
  const result = createBollingerObservationEvidence(trend(240), "1D");
  assert.equal(result.available, true);
  assert.ok(result.byIndicator.RSI.some((item) => item.name === "RSI_ZONE"));
  assert.ok(result.byIndicator.MACD.some((item) => item.name === "MACD_RELATION"
    && "macd" in item.values && "signal" in item.values && "histogram" in item.values));
  assert.ok(result.byIndicator.MACD.some((item) => item.name === "MACD_HISTOGRAM"));
  assert.ok(result.byIndicator.EMA.length > 0);
  assert.ok(result.byIndicator.ATR.length > 0);
  assert.ok(result.byIndicator.VOLUME_RATIO.length > 0);
  assert.equal(adaptMacdCrossStatus("BULLISH_CROSSOVER"), "GOLDEN_CROSS");
  assert.equal(adaptMacdCrossStatus("BEARISH_CROSSOVER"), "DEAD_CROSS");
});

test("unavailable indicator input is handled safely", () => {
  const result = createBollingerObservationEvidence(trend(5), "1W");
  assert.equal(result.available, false);
  assert.equal(result.reason, "UNAVAILABLE_INDICATOR");
  assert.deepEqual(result.evidence, []);

  const partial = createBollingerObservationEvidence(trend(18), "1D");
  assert.equal(partial.available, true);
  assert.deepEqual(partial.byIndicator.EMA, []);
  assert.ok(partial.byIndicator.RSI.length > 0 && partial.byIndicator.ATR.length > 0);
});

test("Phase 3 modules remain detached from forbidden production consumers", () => {
  const files = ["bollingerObservationTypes.ts", "bollingerObservationMath.ts",
    "bollingerObservationDetector.ts", "bollingerObservationEvidence.ts"];
  const source = files.map((file) => readFileSync(`app/lib/technicalObservation/${file}`, "utf8")).join("\n");
  assert.doesNotMatch(source,
    /(?:from|import\s*\()\s*["'][^"']*(?:learning\/pipeline|bollingerBonus|ranking|notification|line|push|cron|aiEngine)/i);

  const forbiddenConsumers = ["app/lib/learning/pipeline.ts", "app/lib/bollingerBonus.ts"];
  for (const file of forbiddenConsumers) {
    const consumer = readFileSync(file, "utf8");
    assert.doesNotMatch(consumer, /bollingerObservation(?:Types|Math|Detector|Evidence)/);
  }
});
