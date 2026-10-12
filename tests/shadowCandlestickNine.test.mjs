import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  SHADOW_CANDLE_PATTERNS,
  detectShadowCandlePatterns,
  studyShadowCandlePatterns,
} from "../app/lib/research/shadowCandlestickNine.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const baseTime = 1780000000;

function bar(i, open, close, high = Math.max(open, close) + 1, low = Math.min(open, close) - 1) {
  return { time: baseTime + i * 86400, open, close, high, low };
}

function lead(direction) {
  return Array.from({ length: 12 }, (_, i) => {
    const close = direction === "LOW" ? 125 - 2 * i : 95 + 2 * i;
    return bar(i, close + (direction === "LOW" ? .5 : -.5), close);
  });
}

const fixtures = [
  ["SH_CDL_BULL_ENGULF", "LOW", [101, 97], [96, 102]],
  ["SH_CDL_BEAR_ENGULF", "HIGH", [119, 123], [124, 118]],
  ["SH_CDL_BULL_HARAMI", "LOW", [101, 96], [97, 99]],
  ["SH_CDL_BEAR_HARAMI", "HIGH", [119, 124], [123, 121]],
  ["SH_CDL_BULL_MEETING", "LOW", [101, 97], [96, 97.1]],
  ["SH_CDL_BEAR_MEETING", "HIGH", [119, 123], [124, 122.9]],
  ["SH_CDL_TWEEZER_BOTTOM", "LOW", [101, 97, 102, 96.5], [97, 99, 100, 96.6]],
  ["SH_CDL_TWEEZER_TOP", "HIGH", [119, 123, 123.5, 118], [123, 120, 123.6, 119]],
  ["SH_CDL_PIERCING", "LOW", [101, 96], [95, 99]],
];

function makeFixture(direction, first, second) {
  const b = lead(direction);
  b.push(bar(12, ...first), bar(13, ...second));
  return b;
}

test("exactly nine distinct SHADOW pattern IDs and no production IDs", () => {
  assert.equal(SHADOW_CANDLE_PATTERNS.length, 9);
  assert.equal(new Set(SHADOW_CANDLE_PATTERNS.map(x => x.id)).size, 9);
  assert.ok(SHADOW_CANDLE_PATTERNS.every(x => x.id.startsWith("SH_CDL_")));
  assert.equal(SHADOW_CANDLE_PATTERNS.filter(x => x.direction === "BUY").length, 5);
  assert.equal(SHADOW_CANDLE_PATTERNS.filter(x => x.direction === "SELL").length, 4);
});

test("all nine fixture pairs can be detected independently with historical context", () => {
  for (const [id, direction, first, second] of fixtures) {
    const history = makeFixture(direction, first, second);
    const actual = detectShadowCandlePatterns(history).map(x => x.id);
    assert.ok(actual.includes(id), `${id} was not detected: ${actual.join(", ")}`);
  }
});

test("no market zone, no completed signal; never treats an unformed candle as proof", () => {
  const flat = Array.from({ length: 12 }, (_, i) => bar(i, 100, 100.1));
  flat.push(bar(12, 101, 96), bar(13, 95, 103));
  assert.deepEqual(detectShadowCandlePatterns(flat), []);
});

test("one-, three- and five-day outcomes require their actual future close bars", () => {
  const initial = makeFixture("LOW", [101, 97], [96, 102]);
  let study = studyShadowCandlePatterns(initial).find(x => x.definition.id === "SH_CDL_BULL_ENGULF");
  assert.ok(study.hits.length > 0);
  assert.deepEqual(study.horizons.map(x => x.completed), [0, 0, 0]);
  const withFuture = [
    ...initial,
    ...[103, 105, 104, 107, 109].map((close, j) => bar(j + 14, close - .25, close)),
  ];
  study = studyShadowCandlePatterns(withFuture).find(x => x.definition.id === "SH_CDL_BULL_ENGULF");
  assert.deepEqual(study.horizons.map(x => x.completed), [1, 1, 1]);
  assert.ok(study.horizons.every(x => x.success === 1 && x.averageDirectionalReturnPercent > 0));
  assert.equal(study.horizons[0].winRatePercent, 100);
});

test("shadow module cannot modify scoring, LINE notifications or learning DB", () => {
  const source = read("app/lib/research/shadowCandlestickNine.ts");
  assert.doesNotMatch(source, /\b(?:fetch|pool\.query|INSERT|UPDATE|DELETE|saveDisplaySnapshot|calculateAiScore|sendLine|runScan)\s*\(/i);
  const api = read("app/admin/shadow-candlestick-nine/page.tsx");
  const ownerIndex = api.indexOf("if (!isOwner) notFound()");
  const yahooIndex = api.indexOf("await fetchOneDailyHistory(requested)");
  assert.ok(ownerIndex > 0 && yahooIndex > ownerIndex);
  assert.match(api, /validCode\s*\?\s*await fetchOneDailyHistory\(requested\)/);
  assert.match(api, /dateJst\(time\) >= cutoff/);
  assert.match(api, /cache: "no-store"/);
  assert.doesNotMatch(api, /\b(?:INSERT|UPDATE|DELETE|runScan|saveDisplaySnapshot|sendLine)\s*\(/i);
});

test("research is linked only from owner-protected hub, and production engine never imports this lab", () => {
  const hub = read("app/admin/learning-hub/page.tsx");
  const engine = read("app/lib/chartPatternEngine.ts");
  assert.match(hub, /href: "\/admin\/shadow-candlestick-nine"/);
  assert.doesNotMatch(engine, /shadowCandlestickNine|SH_CDL_/);
  assert.doesNotMatch(read("app/lib/learning/stockAnalyzer.ts"), /shadowCandlestickNine|SH_CDL_/);
});
