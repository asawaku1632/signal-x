import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  detectMsbOrderBlockRetest, findBullishStructureBreak,
  studyMsbMaSwing, SWING_RESEARCH_VARIANTS,
} from "../app/lib/research/msbMaSwing.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
function candle(i, close = 100, options = {}) {
  const open = options.open ?? close - .2;
  return { time: 1780000000 + i * 86400, open, close,
    high: options.high ?? Math.max(open, close) + .6,
    low: options.low ?? Math.min(open, close) - .6,
    volume: options.volume ?? 1000 };
}
function fixture(options = {}) {
  const bars = Array.from({ length: 63 }, (_, i) => candle(i));
  // 38 has a visibly rejected high, confirmed by bars 39 and 40.
  bars[38] = candle(38, 100, { high: 130, low: 99 });
  // Pre-break last bearish candle is a hypothetical OB zone.
  bars[45] = candle(45, 99, { open: 101, high: 101.5, low: 98.5 });
  bars[47] = candle(47, 131.5, { open: 100, high: 132, low: 99, volume: 1500 });
  bars[48] = candle(48, 118, {
    open: options.noRetest ? 112 : 109, low: options.noRetest ? 110 : 100.5, high: 119,
    volume: options.lowVolume ? 1000 : 2100,
  });
  bars[49] = candle(49, 115);
  bars[50] = candle(50, 117);
  bars[51] = candle(51, 118);
  bars[52] = candle(52, 119);
  bars[53] = candle(53, options.loss ? 95 : 120);
  return bars;
}
const entry = report => report.trades.find(t => t.code === "3182" && t.signalIndex === 48);

test("genuine confirmed prior pivot, break and retest yield isolated OB hypothesis", () => {
  const c = fixture();
  const ob = findBullishStructureBreak(c, 47);
  assert.ok(ob);
  assert.equal(ob.breakIndex, 47);
  assert.equal(ob.pivotHigh, 130);
  assert.equal(ob.originIndex, 45);
  assert.equal(detectMsbOrderBlockRetest(c, 47), null);
  assert.deepEqual(detectMsbOrderBlockRetest(c, 48), ob);
});

test("4 variant subsets retain identical hypothetical entry and exit prices", () => {
  const report = studyMsbMaSwing([{ code: "3182", candles: fixture() }]);
  assert.deepEqual(SWING_RESEARCH_VARIANTS.map(v => v.id),
    ["MA525", "MA525_VOLUME", "MA525_MSB_OB", "MA525_ALL"]);
  const e = entry(report);
  assert.ok(e, "retest remains an observation even when preceding break qualifies for MA");
  assert.ok(e.eligible.MA525 && e.eligible.MA525_VOLUME &&
    e.eligible.MA525_MSB_OB && e.eligible.MA525_ALL);
  assert.equal(e.signalIndex, 48);
  assert.equal(e.entryTime, fixture()[49].time);
  assert.equal(e.exitTime, fixture()[53].time);
  assert.ok(e.entryPrice > 0 && e.exitPrice > 0);
  const stats = Object.fromEntries(report.stats.map(v => [v.id, v]));
  assert.ok(stats.MA525_ALL.trades <= stats.MA525_VOLUME.trades);
  assert.ok(stats.MA525_ALL.trades <= stats.MA525_MSB_OB.trades);
});

test("weak volume blocks variants ② and ④, without hiding OB variant ③", () => {
  const e = entry(studyMsbMaSwing([{ code: "3182", candles: fixture({ lowVolume: true }) }]));
  assert.ok(e && e.orderBlock);
  assert.equal(e.eligible.MA525_VOLUME, false);
  assert.equal(e.eligible.MA525_MSB_OB, true);
  assert.equal(e.eligible.MA525_ALL, false);
});

test("missing retest blocks variants ③ and ④ but does not invent large-order evidence", () => {
  const c = fixture({ noRetest: true });
  assert.equal(detectMsbOrderBlockRetest(c, 48), null);
  const e = entry(studyMsbMaSwing([{ code: "3182", candles: c }]));
  assert.ok(e);
  assert.equal(e.orderBlock, null);
  assert.equal(e.eligible.MA525_MSB_OB, false);
  assert.equal(e.eligible.MA525_ALL, false);
});

test("future changes can affect realized outcome but not as-of eligibility", () => {
  const first = fixture();
  const before = entry(studyMsbMaSwing([{ code: "3182", candles: first }]));
  const later = fixture({ loss: true });
  later[54] = candle(54, 200);
  const after = entry(studyMsbMaSwing([{ code: "3182", candles: later }]));
  assert.ok(before && after);
  assert.deepEqual(after.eligible, before.eligible);
  assert.deepEqual(after.orderBlock, before.orderBlock);
  assert.equal(after.volumeRatio, before.volumeRatio);
  assert.ok(after.profitYen100 < before.profitYen100);
});

test("unfinished future and invalid candles fail closed without fabricated zero win rate", () => {
  const pending = studyMsbMaSwing([{ code: "3182", candles: fixture().slice(0, 49) }]);
  assert.ok(pending.pendingBaseCandidates >= 1);
  assert.equal(pending.stats.find(x => x.id === "MA525_ALL").winRatePercent, null);
  const invalid = fixture();
  invalid[48] = { ...invalid[48], time: invalid[47].time };
  const report = studyMsbMaSwing([{ code: "3182", candles: invalid }]);
  assert.equal(report.cohortCount, 0);
  assert.deepEqual(report.invalidCodes, ["3182"]);
});

test("strict owner check and on-demand fetch, no DB writes or production effects", () => {
  const page = read("app/admin/shadow-msb-ob-swing/page.tsx");
  const core = read("app/lib/research/msbMaSwing.ts");
  const owner = page.indexOf("if (!isOwner) notFound()");
  const fetch = page.indexOf("await fetchCohort(codes)");
  assert.ok(owner >= 0 && fetch > owner);
  assert.match(page, /attempted && !inputError \? await fetchCohort\(codes\)/);
  assert.match(page, /自動保存はありません/);
  assert.match(page, /過去にさかのぼって復元した比較ではありません/);
  assert.doesNotMatch(core + page, /\b(?:INSERT|UPDATE|DELETE|runScan|sendLine|calculateAiScore)\s*\(/);
  assert.match(read("app/admin/learning-hub/page.tsx"), /\/admin\/shadow-msb-ob-swing/);
});
