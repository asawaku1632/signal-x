import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const engine = await import(
  pathToFileURL(resolve(process.cwd(), "app/lib/chartPatternEngine.ts")).href
);
const seasonalityModule = await import(
  pathToFileURL(resolve(process.cwd(), "app/lib/marketSeasonality.ts")).href
);

const {
  detectChartPatterns,
  detectJapaneseCandlestickPatterns,
} = engine;
const { getMarketSeasonality } = seasonalityModule;

function candle(time, open, high, low, close, volume = 100) {
  return { time, open, high, low, close, volume };
}

function detectJapanese(candles, volumeRatio = 1.4) {
  const patterns = [];
  detectJapaneseCandlestickPatterns(candles, volumeRatio, patterns);
  return patterns;
}

const fixtures = new Map([
  ["pattern049", [
    candle(0, 100, 111, 99, 110),
    candle(1, 109, 109.5, 106.5, 107),
    candle(2, 107.5, 108, 105.5, 106),
    candle(3, 106, 108.5, 105.8, 108),
    candle(4, 108, 113, 107.5, 112.5, 160),
  ]],
  ["pattern050", [
    candle(0, 100, 103.5, 99.7, 103),
    candle(1, 102.2, 105.5, 102, 105),
    candle(2, 104.2, 107.5, 104, 107, 150),
  ]],
  ["pattern051", [
    candle(0, 110, 110.5, 101.5, 102),
    candle(1, 101.5, 102.2, 100.8, 101.2),
    candle(2, 101.5, 107.5, 101.2, 107, 150),
  ]],
  ["pattern052", [
    candle(0, 100, 102, 98, 100.2),
  ]],
  ["pattern053", [
    candle(0, 107, 107.3, 103.5, 104),
    candle(1, 105, 105.2, 101.5, 102),
    candle(2, 103, 103.2, 99.5, 100, 150),
  ]],
  ["pattern054", [
    candle(0, 100, 108.5, 99.7, 108),
    candle(1, 108.5, 109, 102.5, 103, 160),
  ]],
  ["pattern055", [
    candle(0, 100, 108.5, 99.7, 108),
    candle(1, 108.5, 109.2, 108.1, 108.8),
    candle(2, 108, 108.2, 102.5, 103, 160),
  ]],
]);

for (const [id, candles] of fixtures) {
  const detected = detectJapanese(candles);
  assert.ok(
    detected.some((pattern) => pattern.id === id),
    `${id} was not detected: ${JSON.stringify(detected)}`,
  );
}

const tripleTop = [
  candle(0, 100, 101, 99, 100),
  candle(1, 100, 104, 99.5, 103),
  candle(2, 103, 108, 102, 107),
  candle(3, 107, 112, 106, 110),
  candle(4, 110, 110.5, 106, 107),
  candle(5, 107, 108, 102, 103),
  candle(6, 103, 109, 102.5, 108),
  candle(7, 108, 111.5, 107, 110),
  candle(8, 110, 110.4, 105, 106),
  candle(9, 106, 107, 101, 102),
  candle(10, 102, 109, 101.5, 108),
  candle(11, 108, 112.2, 107, 110),
  candle(12, 110, 110.3, 105, 106),
  candle(13, 106, 106.5, 102, 103),
  candle(14, 103, 103.5, 99.5, 100, 180),
];

const tripleTopDetected = detectChartPatterns(tripleTop);
assert.ok(
  tripleTopDetected.some((pattern) => pattern.id === "pattern048"),
  `pattern048 was not detected: ${JSON.stringify(tripleTopDetected)}`,
);

const expectedActions = [
  "BUY", "WAIT", "SELL", "BUY", "WAIT", "SELL",
  "SELL", "BUY", "BUY", "SELL", "BUY", "SELL",
];

for (let month = 1; month <= 12; month++) {
  const seasonality = getMarketSeasonality(
    new Date(Date.UTC(2026, month - 1, 15, 12, 0, 0)),
  );
  assert.equal(seasonality.month, month);
  assert.equal(seasonality.action, expectedActions[month - 1]);
  assert.ok(Math.abs(seasonality.scoreImpact) <= 2);
}

console.log(JSON.stringify({
  japaneseCandlestickPatterns: [...fixtures.keys()],
  tripleTop: "PASS",
  seasonalityMonths: 12,
  status: "PASS",
}, null, 2));
