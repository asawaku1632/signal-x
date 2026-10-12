import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { studyHorizontalRetest } from "../app/lib/research/horizontalRetest.ts";
import { compareHorizontalRetest, HORIZONTAL_VARIANTS } from "../app/lib/research/horizontalRetestComparison.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
function candle(i, close, overrides = {}) {
  const open = overrides.open ?? close - 0.2;
  return { time: 1780000000 + i * 86400, open, close,
    high: overrides.high ?? Math.max(open, close) + 0.6,
    low: overrides.low ?? Math.min(open, close) - 0.6,
    volume: overrides.volume ?? 1000 };
}
function fixture({ volume = 2200, weakCandle = false, stop = false } = {}) {
  const c = Array.from({ length: 70 }, (_, i) => candle(i, 90 + 0.22 * i));
  c[35] = candle(35, 97.7, { high: 110, low: 97, volume: 1200 });
  c[47] = candle(47, 100.34, { high: 110.3, low: 99.8, volume: 1100 });
  c[65] = candle(65, 112, { open: 108, high: 113, low: 107, volume });
  c[66] = candle(66, 111, weakCandle
    ? { open: 110.5, high: 115, low: 109 }
    : { open: 109, high: 112, low: 109 });
  c[67] = stop
    ? candle(67, 113, { open: 111, high: 118, low: 107 })
    : candle(67, 116, { open: 111, high: 117, low: 110 });
  c[68] = candle(68, 113, { open: 113, high: 115, low: 110 });
  c[69] = candle(69, 113, { open: 113, high: 115, low: 110 });
  return c;
}
const compare = (...datasets) => compareHorizontalRetest(datasets.map(([code, candles]) => ({ code, candles })));
const stats = result => Object.fromEntries(result.comparison.map(s => [s.id, s]));

test("three strictly nested variants with clear naming that does not claim reconstructed AI POWER", () => {
  assert.deepEqual(HORIZONTAL_VARIANTS.map(v => v.id), ["BASE", "TREND_VOLUME", "TECHNICAL"]);
  const text = JSON.stringify(HORIZONTAL_VARIANTS);
  assert.match(text, /MACD/);
  assert.match(text, /RSI/);
  assert.doesNotMatch(text, /AI POWER.*再現/);
});

test("baseline metrics are exactly those of existing unchanged horizontal study", () => {
  const c = fixture({ stop: true });
  const base = studyHorizontalRetest(c);
  const result = compare(["2760", c]);
  const s = stats(result).BASE;
  assert.equal(s.eligible, base.completed);
  assert.equal(s.winRatePercent, base.winRatePercent);
  assert.equal(s.profitYen100, base.profitYen100);
  assert.equal(s.maxDrawdownYen100, base.maxDrawdownYen100);
  assert.equal(result.entries[0].trade.profitYen100, base.trades[0].profitYen100);
});

test("volume tightening excludes a previously valid losing base trade", () => {
  const c = fixture({ volume: 1250, stop: true });
  const r = compare(["8058", c]);
  assert.equal(r.entries.length, 1);
  assert.equal(stats(r).BASE.eligible, 1);
  assert.equal(stats(r).BASE.wins, 0);
  assert.equal(stats(r).TREND_VOLUME.eligible, 0);
  assert.equal(stats(r).TECHNICAL.eligible, 0);
  assert.equal(stats(r).TREND_VOLUME.winRatePercent, null);
  assert.equal(stats(r).TECHNICAL.worstProfitYen100, null);
  assert.equal(stats(r).TECHNICAL.maxDrawdownYen100, null);
  assert.ok(r.entries[0].failed.some(s => s.includes("出来高")));
});

test("technical candle confirmation can filter a trade accepted by volume+trend", () => {
  const r = compare(["8058", fixture({ weakCandle: true })]);
  assert.equal(stats(r).BASE.eligible, 1);
  assert.equal(stats(r).TREND_VOLUME.eligible, 1);
  assert.equal(stats(r).TECHNICAL.eligible, 0);
  assert.ok(r.entries[0].failed.some(s => s.includes("反発陽線")));
});

test("strict candidate subset never invents a new entry price, stop, or exit", () => {
  const a = fixture();
  const b = fixture({ volume: 1250, stop: true });
  const r = compare(["3182", a], ["8058", b]);
  const s = stats(r);
  assert.equal(r.completedBaseTrades, 2);
  assert.equal(s.BASE.eligible, 2);
  assert.equal(s.TREND_VOLUME.eligible, 1);
  assert.ok(s.TECHNICAL.eligible <= s.TREND_VOLUME.eligible);
  assert.equal(s.BASE.profitYen100, r.entries.reduce((sum, e) => sum + e.trade.profitYen100, 0));
  assert.equal(s.TREND_VOLUME.profitYen100,
    r.entries.filter(e => e.eligible.TREND_VOLUME).reduce((sum,e) => sum+e.trade.profitYen100, 0));
  assert.ok(r.entries.every(e => !e.eligible.TECHNICAL || e.eligible.TREND_VOLUME));
});

test("retest eligibility does not look at future next open or later outcome candles", () => {
  const c = fixture();
  const before = compare(["3182", c]).entries[0];
  c[67] = candle(67, 125, { open: 120, low: 119, high: 127 });
  const after = compare(["3182", c]).entries[0];
  assert.deepEqual(after.eligible, before.eligible);
  assert.equal(after.rsiAtRetest, before.rsiAtRetest);
  assert.equal(after.macdHistogramAtRetest, before.macdHistogramAtRetest);
  assert.equal(after.breakoutVolumeRatio, before.breakoutVolumeRatio);
});

test("empty or unfinished cohorts have no fabricated 0% win rate", () => {
  const empty = compare();
  assert.equal(empty.completedBaseTrades, 0);
  assert.ok(empty.comparison.every(s => s.eligible === 0 && s.winRatePercent === null));
  const c = fixture().slice(0, 69);
  const pending = compare(["3994", c]);
  assert.equal(pending.completedBaseTrades, 0);
  assert.ok(pending.comparison.every(s => s.winRatePercent === null));
});

test("owner-only on-demand, no production scoring or DB writes or notifications", () => {
  const page = read("app/admin/horizontal-retest/page.tsx");
  const research = read("app/lib/research/horizontalRetestComparison.ts");
  assert.ok(page.indexOf("if (!isOwner) notFound()") < page.indexOf("await fetchCohort(codes)"));
  assert.match(page, /attempted && !inputError \? await fetchCohort\(codes\)/);
  assert.match(page, /過去のAI POWER/);
  assert.match(page, /対象0件/);
  assert.doesNotMatch(research + page, /\b(?:INSERT|UPDATE|DELETE|runScan|saveDisplaySnapshot|sendLine|calculateAiScore|fetch)\s*\(/i);
  assert.doesNotMatch(read("app/lib/learning/stockAnalyzer.ts"), /horizontalRetestComparison/);
  assert.doesNotMatch(read("app/lib/chartPatternEngine.ts"), /horizontalRetestComparison/);
});
