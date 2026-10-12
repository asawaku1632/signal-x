import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { studyMsbMaSwing } from "../app/lib/research/msbMaSwing.ts";
import {
  historicalVolumeRatio, selectNonOverlappingSwing, studySwingVolumeSensitivity,
  VOLUME_THRESHOLDS,
} from "../app/lib/research/msbMaVolumeSensitivity.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const candle = (i, close = 100, overrides = {}) => {
  const open = overrides.open ?? close - .2;
  return { time: 1780000000 + i * 86400, open, close,
    high: overrides.high ?? Math.max(open, close) + .6,
    low: overrides.low ?? Math.min(open, close) - .6,
    volume: overrides.volume ?? 1000 };
};
function fixture({ breakVolume = 1500, retestVolume = 2100 } = {}) {
  const c = Array.from({ length: 63 }, (_, i) => candle(i));
  c[38] = candle(38, 100, { high: 130, low: 99 });
  c[45] = candle(45, 99, { open: 101, high: 101.5, low: 98.5 });
  c[47] = candle(47, 131.5, { open: 100, high: 132, low: 99, volume: breakVolume });
  c[48] = candle(48, 118, { open: 109, low: 100.5, high: 119, volume: retestVolume });
  c[49] = candle(49, 115);
  c[50] = candle(50, 117);
  c[51] = candle(51, 118);
  c[52] = candle(52, 119);
  c[53] = candle(53, 120);
  return c;
}
const study = candles => {
  const cohorts = [{ code: "3182", candles }];
  const report = studyMsbMaSwing(cohorts);
  return studySwingVolumeSensitivity(cohorts, report);
};
const row = (result, threshold) => result.rows.find(r => r.threshold === threshold);

test("four thresholds compare exactly the same OB non-overlapping population", () => {
  const output = study(fixture());
  assert.deepEqual([...VOLUME_THRESHOLDS], [0, 1, 1.2, 1.5]);
  assert.ok(output.obObservationCount >= 1);
  assert.equal(row(output, 0).both.count, output.obNonOverlapCount);
  assert.ok(row(output, 1.5).both.count <= row(output, 1.2).both.count);
  assert.ok(row(output, 1.2).both.count <= row(output, 1).both.count);
  assert.ok(output.baselineNonOverlap.every(s => s.count <= output.nonOverlapBaseCount));
});

test("breakout/retest-day comparisons are distinct, with no retroactive volume leakage", () => {
  // Break volume 1500 against historical 1000, retest 1100 against
  // historical 1025 (includes preceding breakout day): qualifies 1.0 but not 1.2.
  const data = fixture({ breakVolume: 1500, retestVolume: 1100 });
  const output = study(data);
  const ob = output.details.find(e => e.trade.signalIndex === 48);
  assert.ok(ob && ob.breakoutRatio !== null && ob.retestRatio !== null);
  assert.equal(ob.breakoutRatio, 1.5);
  assert.ok(ob.retestRatio > 1 && ob.retestRatio < 1.2);
  assert.ok(row(output, 1.2).breakout.count > row(output, 1.2).both.count);
  assert.equal(row(output, 1.2).both.count, row(output, 1.2).retest.count);
  assert.equal(historicalVolumeRatio(data, 47), 1.5);
});

test("missing volume cannot pass any positive threshold; no requirement retains unknown", () => {
  const bars = fixture();
  bars[47] = { ...bars[47], volume: undefined };
  bars[48] = { ...bars[48], volume: undefined };
  const output = study(bars);
  assert.ok(output.obNonOverlapCount >= 1);
  assert.ok(output.missingBreakoutVolume >= 1 && output.missingRetestVolume >= 1);
  assert.ok(row(output, 0).both.count > row(output, 1).both.count);
  assert.equal(historicalVolumeRatio(bars, 47), null);
  assert.equal(historicalVolumeRatio(bars, 48), null);
});

test("non-overlap selector drops same-symbol conflicting holding windows, retains other symbols", () => {
  const x = (code, signalTime, entryTime, exitTime) => ({ code, signalTime, entryTime, exitTime });
  const input = [
    x("3182", 1, 2, 7), x("3182", 2, 4, 9), x("3182", 10, 11, 16),
    x("9984", 3, 4, 9), x("3182", 7, 7, 12),
  ];
  const result = selectNonOverlappingSwing(input);
  assert.deepEqual(result.map(t => [t.code, t.signalTime]),
    [["3182", 1], ["3182", 10], ["9984", 3]]);
});

test("outcomes from future bars cannot change as-of volume thresholds or selected candidate set", () => {
  const data = fixture({ breakVolume: 1500, retestVolume: 1100 });
  const original = study(data);
  const changed = data.map(x => ({ ...x }));
  changed[53].close = 80;
  changed[53].open = 85;
  changed[53].low = 79;
  changed[53].high = 86;
  const modified = study(changed);
  const before = original.details.find(e => e.trade.signalIndex === 48);
  const after = modified.details.find(e => e.trade.signalIndex === 48);
  assert.ok(before && after);
  assert.equal(before.breakoutRatio, after.breakoutRatio);
  assert.equal(before.retestRatio, after.retestRatio);
  assert.equal(before.trade.eligible.MA525_ALL, after.trade.eligible.MA525_ALL);
  assert.ok(before.trade.profitYen100 > after.trade.profitYen100);
});

test("no candidates means undefined win-rate, not a fabricated 0%", () => {
  const output = study([]);
  assert.equal(output.obObservationCount, 0);
  assert.equal(row(output, 0).both.winRatePercent, null);
  assert.equal(row(output, 1.5).breakout.averageProfitYen100, null);
});

test("owner gate before external fetch, research-only source and no new background operations", () => {
  const page = read("app/admin/shadow-msb-ob-swing/page.tsx");
  const core = read("app/lib/research/msbMaVolumeSensitivity.ts");
  assert.ok(page.indexOf("if (!isOwner) notFound()") <
    page.indexOf("await fetchCohort(codes)"));
  assert.match(page, /attempted && !inputError \? await fetchCohort\(codes\)/);
  assert.match(page, /出来高は何倍が適切/);
  assert.match(page, /突破日だけ/);
  assert.match(page, /重複を除いたら/);
  assert.doesNotMatch(core + page, /\b(?:INSERT|UPDATE|DELETE|runScan|sendLine|calculateAiScore|savePaperTrade)\s*\(/);
  assert.doesNotMatch(read("app/lib/learning/stockAnalyzer.ts"), /msbMaVolumeSensitivity/);
});
