import assert from "node:assert/strict";
import test from "node:test";
import {
  REBOUND_RISK_CUTOFF, REBOUND_RISK_RULES,
  inspectReboundHint, riskFlag, assessReboundRiskRule, buildReboundRiskCases,
} from "../app/lib/research/supportReboundRiskStudy.ts";

function candles() {
  return Array.from({ length: 100 }, (_, i) => ({
    time: 1700000000 + i * 86400,
    open: 100, close: 100, high: 101, low: 99, volume: 1000,
  }));
}
const makeTrade = (returnPercent, start, signalIndex = 60) => ({
  signalIndex, signalTime: start - 86400, entryTime: start, exitTime: start + 5 * 86400,
  entryPrice: 100, exitPrice: 100 + returnPercent, returnPercent,
  pnlYen: returnPercent * 100, worstIntratradePercent: Math.min(0, returnPercent),
});
const makeCase = (returnPercent, entryTime, features) => ({
  code: "7203", hintTime: entryTime - 86400, signalIndex: 60,
  trade: makeTrade(returnPercent, entryTime), features,
});
test("pre-signal volume, SMA50, Bollinger features detect independently", () => {
  const rows = candles();
  const neutral = inspectReboundHint(rows, 65);
  assert.equal(neutral.volumeRatio, 1);
  assert.equal(neutral.thinVolume, false);
  assert.equal(neutral.belowSma50, false);
  assert.equal(neutral.belowBbLower, false);
  rows[65].volume = 500;
  rows[65].close = 80;
  const weak = inspectReboundHint(rows, 65);
  assert.equal(weak.volumeRatio, 0.5);
  assert.equal(weak.thinVolume, true);
  assert.equal(weak.belowSma50, true);
  assert.equal(weak.belowBbLower, true);
  assert.equal(riskFlag(weak, "ANY"), true);
});
test("future candle changes cannot influence past signal features", () => {
  const rows = candles();
  rows[68].close = 90;
  const before = inspectReboundHint(rows, 68);
  rows[69].close = 10000;
  rows[80].volume = 999999;
  assert.deepEqual(inspectReboundHint(rows, 68), before);
});
test("50-session insufficient data, zero volume and split history are unknown, never safe", () => {
  const rows = candles();
  const early = inspectReboundHint(rows, 26);
  assert.equal(early.belowSma50, null);
  assert.equal(riskFlag(early, "ANY"), null);
  rows[60].volume = 0;
  assert.equal(inspectReboundHint(rows, 60).thinVolume, null);
  const split = inspectReboundHint(candles(), 65, [candles()[45].time]);
  assert.equal(split.belowSma50, null);
  assert.equal(split.belowBbLower, null);
  assert.equal(split.volumeRatio, null);
});
test("filter outcomes count large losses AND lost winners, matched denominators", () => {
  const data = candles();
  const neutral = inspectReboundHint(data, 70);
  data[70].volume = 100;
  const risky = inspectReboundHint(data, 70);
  const entry = REBOUND_RISK_CUTOFF + 10 * 86400;
  const cases = [
    makeCase(-6, entry, risky),
    makeCase(2, entry, risky),
    makeCase(-1, entry, neutral),
    makeCase(3, entry, neutral),
  ];
  const result = assessReboundRiskRule(cases, "THIN_VOLUME", "TEST");
  assert.equal(result.totalCompleted, 4);
  assert.equal(result.featureMissing, 0);
  assert.equal(result.rejected.count, 2);
  assert.equal(result.removedMajorLosses, 1);
  assert.equal(result.removedWinners, 1);
  assert.equal(result.retained.count, 2);
  assert.equal(result.eligible.majorLosses, 1);
  assert.equal(result.retained.majorLossRatePercent, 0);
  assert.equal(result.retained.winRatePercent, 50);
  assert.equal(result.eligible.winRatePercent, 50);
  assert.deepEqual(REBOUND_RISK_RULES.map((x) => x.id), ["THIN_VOLUME", "BELOW_SMA50", "BELOW_BB_LOWER", "ANY"]);
});
test("training and test do not leak trades crossing cutoff", () => {
  const neutral = inspectReboundHint(candles(), 65);
  const makeCaseWithTrade = (entry, exitTime) => ({
    ...makeCase(1, entry, neutral),
    trade: { ...makeTrade(1, entry), exitTime },
  });
  const cases = [
    makeCaseWithTrade(REBOUND_RISK_CUTOFF - 10 * 86400, REBOUND_RISK_CUTOFF - 86400),
    makeCaseWithTrade(REBOUND_RISK_CUTOFF + 86400, REBOUND_RISK_CUTOFF + 6 * 86400),
    makeCaseWithTrade(REBOUND_RISK_CUTOFF - 86400, REBOUND_RISK_CUTOFF + 86400),
  ];
  assert.equal(assessReboundRiskRule(cases, "THIN_VOLUME", "TRAIN").totalCompleted, 1);
  assert.equal(assessReboundRiskRule(cases, "THIN_VOLUME", "TEST").totalCompleted, 1);
  assert.equal(assessReboundRiskRule(cases, "THIN_VOLUME", "ALL").totalCompleted, 3);
});
test("build helper uses only saved hint indices; incomplete trades excluded from win rates", () => {
  const rows = candles(), features = inspectReboundHint(rows, 70);
  const opportunities = [{ hintIndex: 70, hintTime: rows[70].time, hintTrade: null }];
  const cases = buildReboundRiskCases([{ code: "7203", candles: rows, opportunities }]);
  assert.equal(cases.length, 1);
  assert.deepEqual(cases[0].features, features);
  assert.equal(assessReboundRiskRule(cases, "ANY", "ALL").totalCompleted, 0);
  assert.equal(assessReboundRiskRule(cases, "ANY", "ALL").pending, 1);
});
