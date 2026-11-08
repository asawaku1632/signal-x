import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { completedDailyBars, observedNecklineOverlay } from "../app/lib/research/observedNecklineOverlay.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(join(root, path), "utf8");
const fixtureNow = new Date("2026-11-09T08:00:00+09:00");
const days = (index) => 1700000000 + index * 86400;
function sample() {
  const bars = Array.from({ length: 44 }, (_, i) => ({
    time: days(i), open: 98, high: 100, low: 97, close: 98, volume: 1000,
  }));
  bars[10] = { ...bars[10], low: 90, close: 95 };
  bars[17] = { ...bars[17], high: 105, close: 102 };
  bars[24] = { ...bars[24], low: 91, close: 92 };
  bars[25] = { ...bars[25], low: 92, close: 94 };
  bars[26] = { ...bars[26], low: 93, close: 98 };
  bars[33] = { ...bars[33], high: 109, close: 108, volume: 2500 };
  return bars;
}

test("bottom 2 is only shown after the two completed confirmation bars, without hindsight", () => {
  assert.equal(observedNecklineOverlay(sample().slice(0, 26), fixtureNow).overlay, null);
  const first = observedNecklineOverlay(sample().slice(0, 27), fixtureNow);
  assert.equal(first.status, "FOUND");
  assert.equal(first.overlay.state, "WATCH");
  assert.equal(first.overlay.firstTime, days(10));
  assert.equal(first.overlay.secondTime, days(24));
  assert.equal(first.overlay.firstSeenTime, days(26));
  assert.equal(first.overlay.low1, 90);
  assert.equal(first.overlay.low2, 91);
  assert.equal(first.overlay.neckline, 105);
  assert.equal(first.overlay.breakoutTime, null);
  const later = observedNecklineOverlay(sample(), fixtureNow);
  assert.equal(later.overlay.state, "BREAKOUT");
  assert.equal(later.overlay.breakoutTime, days(33));
  assert.equal(later.overlay.firstSeenTime, first.overlay.firstSeenTime);
  assert.equal(later.overlay.neckline, first.overlay.neckline);
});

test("an uncompleted current-day candle is excluded; new bars cannot backdate first detection", () => {
  const historical = sample().slice(0, 27);
  const now = new Date("2026-11-09T09:15:00+09:00");
  const ongoing = { ...historical.at(-1), time: Date.parse("2026-11-09T09:00:00+09:00") / 1000, low: 40 };
  const bars = completedDailyBars([...historical, ongoing], now);
  assert.equal(bars.length, historical.length);
  const study = observedNecklineOverlay([...historical, ongoing], now);
  assert.equal(study.overlay.firstSeenTime, days(26));
  assert.equal(study.overlay.neckline, 105);
  const afterClose = completedDailyBars([...historical, ongoing], new Date("2026-11-09T16:20:00+09:00"));
  assert.equal(afterClose.length, historical.length + 1);
});

test("bad, duplicated, reversed, or too-few bars fail closed instead of plotting fabricated marks", () => {
  const bars = sample();
  assert.equal(observedNecklineOverlay(bars.slice(0, 15), fixtureNow).status, "INSUFFICIENT");
  assert.equal(observedNecklineOverlay([...bars, bars.at(-1)], fixtureNow).overlay, null);
  assert.equal(observedNecklineOverlay([...bars].reverse(), fixtureNow).overlay, null);
  assert.equal(observedNecklineOverlay([{...bars[0], low: 111}, ...bars.slice(1)], fixtureNow).overlay, null);
  assert.equal(observedNecklineOverlay([{...bars[0], volume: -1}, ...bars.slice(1)], fixtureNow).overlay, null);
  assert.equal(observedNecklineOverlay([], fixtureNow).overlay, null);
  const notEvenDaily = sample().map(c => ({...c, open: 98, high: 110, low: 85, close: 98}));
  assert.equal(observedNecklineOverlay(notEvenDaily, fixtureNow).status, "NONE");
});

test("actual OHLC charts receive same day-only research overlay, not a simulated entry signal", () => {
  const trading = read("app/chart/[code]/components/TradingChart.tsx");
  const inline = read("app/components/analysis/InlineTradingChart.tsx");
  const visual = read("app/components/analysis/AnalysisVisualGuide.tsx");
  const fullChart = read("app/chart/[code]/page.tsx");
  assert.match(trading, /necklineOverlay\?: ResearchNecklineOverlay \| null/);
  assert.match(trading, /visibleBottomMarkers/);
  assert.match(trading, /bar\.time === marker\.time/);
  assert.match(trading, /ネックライン候補/);
  assert.match(trading, /底①/);
  assert.match(trading, /底②/);
  assert.match(inline, /timeframe === "1D" && chart\.kind === "ready"/);
  assert.match(inline, /observedNecklineOverlay\(candles\)/);
  assert.match(inline, /necklineOverlay=\{timeframe === "1D" \? necklineOverlay : null\}/);
  assert.match(inline, /当日のリアルタイム保存記録ではありません/);
  assert.match(visual, /<PlainCandleChart candles=\{candles\}/);
  assert.match(visual, /observedNecklineOverlay\(candles\)/);
  assert.match(visual, /過去の日足を使った事後的な研究表示/);
  assert.match(fullChart, /timeframe === "1D" && !chartLoading/);
  assert.match(fullChart, /observedNecklineOverlay\(chart\.candles\)/);
  assert.match(fullChart, /necklineOverlay=\{dailyNeckline\?\.overlay \?\? null\}/);
  assert.match(fullChart, /当時のリアルタイム検出記録や売買指示ではありません/);
});
