import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { detectHorizontalBreakoutAt, studyHorizontalRetest } from "../app/lib/research/horizontalRetest.ts";

const src = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
function candle(i, close, options = {}) {
  const open = options.open ?? close - .2;
  return { time: 1780000000 + i * 86400, open, close,
    high: options.high ?? Math.max(open, close) + .6,
    low: options.low ?? Math.min(open, close) - .6,
    volume: options.volume ?? 1000 };
}
function scenario(mode = "WIN") {
  const c = Array.from({ length: 70 }, (_, i) => candle(i, 90 + .22*i));
  c[35] = candle(35, 97.7, { high: 110, low: 97, volume: 1200 });
  c[47] = candle(47, 100.34, { high: 110.3, low: 99.8, volume: 1100 });
  // No close above the resistance in the previous eight bars.
  c[65] = candle(65, 112, { open: 108, high: 113, low: 107, volume: mode === "NO_VOLUME" ? 1000 : 2200 });
  c[66] = mode === "NO_RETEST"
    ? candle(66, 106, { open: 111, high: 112, low: 105 })
    : candle(66, 111, { open: 109, high: 112, low: 109 });
  c[67] = mode === "STOP"
    ? candle(67, 113, { open: 111, high: 118, low: 107 })
    : mode === "PENDING"
      ? candle(67, 113, { open: 111, high: 115, low: 110 })
      : candle(67, 116, { open: 111, high: 117, low: 110 });
  c[68] = candle(68, 113, { open: 113, high: 115, low: 110 });
  c[69] = candle(69, 113, { open: 113, high: 115, low: 110 });
  return c;
}
test("two independent rejected highs, confirmed uptrend, and volume detect a breakout", () => {
  const hit = detectHorizontalBreakoutAt(scenario(), 65);
  assert.ok(hit, "must detect the actual breakout");
  assert.equal(hit.index, 65);
  assert.equal(hit.touches, 2);
  assert.ok(hit.level >= 110 && hit.level <= 110.3);
});
test("positive price move is NOT sufficient without strong volume", () => {
  assert.equal(detectHorizontalBreakoutAt(scenario("NO_VOLUME"), 65), null);
});
test("future price changes cannot change a signal already produced", () => {
  const series = scenario();
  const before = detectHorizontalBreakoutAt(series, 65);
  series[66] = candle(66, 200);
  series[67] = candle(67, 400);
  assert.deepEqual(detectHorizontalBreakoutAt(series, 65), before);
});
test("retest confirmed by bullish bar, enter next open, target exits with 100 share profit", () => {
  const report = studyHorizontalRetest(scenario());
  assert.equal(report.completed, 1);
  assert.equal(report.retestCount, 1);
  assert.equal(report.wins, 1);
  assert.equal(report.winRatePercent, 100);
  assert.ok(report.profitYen100 > 0);
  assert.equal(report.trades[0].entryIndex, 67);
  assert.equal(report.trades[0].reason, "TARGET");
});
test("when target AND stop trade within same OHLC, conservatively stop first", () => {
  const report = studyHorizontalRetest(scenario("STOP"));
  assert.equal(report.completed, 1);
  assert.equal(report.wins, 0);
  assert.ok(report.profitYen100 < 0);
  assert.equal(report.trades[0].reason, "STOP");
});
test("a break below the old ceiling invalidates retest signal", () => {
  const report = studyHorizontalRetest(scenario("NO_RETEST"));
  assert.ok(report.breakoutCount > 0);
  assert.equal(report.retestCount, 0);
  assert.equal(report.completed, 0);
  assert.equal(report.winRatePercent, null);
});
test("open exits without full future 5 days remain unresolved, not a loss", () => {
  const report = studyHorizontalRetest(scenario("PENDING").slice(0, 69));
  assert.equal(report.retestCount, 1);
  assert.equal(report.completed, 0);
  assert.equal(report.winRatePercent, null);
});
test("invalid candle times are refused rather than silently backtested", () => {
  const bars = scenario();
  bars[66] = { ...bars[66], time: bars[65].time };
  assert.equal(studyHorizontalRetest(bars).completed, 0);
});
test("shadow-only modules are isolated and explicit owner gate precedes requests", () => {
  const study = src("app/lib/research/horizontalRetest.ts");
  const page = src("app/admin/horizontal-retest/page.tsx");
  const ownerAt = page.indexOf("if (!isOwner) notFound()");
  const fetchAt = page.indexOf("await fetchCohort(codes)");
  assert.ok(ownerAt > -1 && fetchAt > ownerAt);
  assert.match(page, /attempted && !inputError \? await fetchCohort\(codes\)/);
  assert.doesNotMatch(study + page, /\b(?:INSERT|UPDATE|DELETE|runScan|saveDisplaySnapshot|sendLine|calculateAiScore)\s*\(/);
  assert.doesNotMatch(src("app/lib/learning/stockAnalyzer.ts"), /horizontalRetest/);
  assert.doesNotMatch(src("app/lib/chartPatternEngine.ts"), /horizontalRetest/);
});
