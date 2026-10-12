import assert from "node:assert/strict";
import test from "node:test";
import {
  REBOUND_SCORE_VERSION, scoreHintAtClose, buildScoredHints, compareRiskScore,
} from "../app/lib/research/supportReboundRiskScore.ts";
import { REBOUND_RISK_CUTOFF } from "../app/lib/research/supportReboundRiskStudy.ts";
function bars() {
  return Array.from({ length: 90 }, (_, i) => ({
    time: 1700000000 + i * 86400,
    open: 100, high: 101, low: 99, close: 100, volume: 1000,
  }));
}
function caseWith(band, value, time = REBOUND_RISK_CUTOFF + 86400) {
  return {
    code: "7203", hintTime: time - 86400, score: band === null ? null : band === "LOW" ? 0 : band === "MID" ? 45 : 70,
    band, features: null,
    trade: value === null ? null : {
      signalIndex: 65, signalTime: time - 86400, entryTime: time,
      exitTime: time + 5 * 86400, entryPrice: 100, exitPrice: 100 + value,
      returnPercent: value, pnlYen: value * 100, worstIntratradePercent: Math.min(value, 0),
    },
  };
}
test("v1 baseline uses closed candles, 60-bar warmup and interpretable 0-100 band", () => {
  assert.equal(REBOUND_SCORE_VERSION, "REBOUND_LOSS_RISK_V1");
  const rows = bars();
  const before = scoreHintAtClose(rows, 65);
  assert.equal(before.score, 0);
  assert.equal(before.band, "LOW");
  assert.equal(before.features.rsi14, 50);
  assert.equal(before.features.atr14Percent, 2);
  assert.equal(before.features.volumeRatio20, 1);
  assert.equal(scoreHintAtClose(rows, 58).score, null);
});
test("future edits cannot alter score computed at an earlier hint", () => {
  const rows = bars(), original = scoreHintAtClose(rows, 65);
  rows[66] = { ...rows[66], close: 999, high: 999, volume: 99999 };
  rows[89] = { ...rows[89], low: 1, high: 1000 };
  assert.deepEqual(scoreHintAtClose(rows, 65), original);
});
test("missing or split-affected data is unknown, never low", () => {
  const rows = bars();
  rows[65].volume = 0;
  assert.deepEqual(scoreHintAtClose(rows, 65), { score: null, band: null, features: null });
  const others = bars();
  assert.equal(scoreHintAtClose(others, 65, [others[21].time]).score, null);
  assert.equal(scoreHintAtClose(others, -1).score, null);
  others[65].high = 95;
  assert.equal(scoreHintAtClose(others, 65).score, null);
});
test("fixed weights react to weaker conditions without touching outcome", () => {
  const rows = bars();
  for (let i = 45; i <= 65; i++) {
    const closing = 100 - (i - 44) * 1.2;
    rows[i] = { ...rows[i], open: closing + 0.7, close: closing, high: closing + 1.5, low: closing - 1 };
  }
  rows[65].volume = 300;
  const risky = scoreHintAtClose(rows, 65);
  assert.ok(risky.score > 0);
  assert.ok(risky.score <= 100);
  assert.ok(risky.features.sma50Slope10Percent < 0);
  assert.ok(risky.features.rsi14 < 30);
  assert.ok(risky.features.volumeRatio20 < 0.7);
});
test("same denominator: excluded big losses and excluded winning trades both counted", () => {
  const data = [
    caseWith("HIGH", -7), caseWith("HIGH", 3),
    caseWith("MID", -2), caseWith("LOW", 5),
    caseWith(null, -9), caseWith("HIGH", null),
  ];
  const x = compareRiskScore(data, "TEST");
  assert.equal(x.completed, 5);
  assert.equal(x.unknown, 1);
  assert.equal(x.known.count, 4);
  assert.equal(x.excluded.count, 2);
  assert.equal(x.excludedBigLosses, 1);
  assert.equal(x.excludedWinners, 1);
  assert.equal(x.retained.count, 2);
  assert.equal(x.retained.wins, 1);
  assert.equal(x.known.bigLossPercent, 25);
  assert.equal(x.retained.bigLossPercent, 0);
  assert.equal(x.bands.reduce((sum, b) => sum + b.metrics.count, 0), 4);
});
test("training and test partition exclude straddling trades; no forward outcomes invented", () => {
  const early = caseWith("LOW", 2, REBOUND_RISK_CUTOFF - 20 * 86400);
  const crossed = { ...caseWith("HIGH", -8, REBOUND_RISK_CUTOFF - 86400),
    trade: { ...caseWith("HIGH", -8, REBOUND_RISK_CUTOFF - 86400).trade, exitTime: REBOUND_RISK_CUTOFF + 86400 } };
  const late = caseWith("MID", -1, REBOUND_RISK_CUTOFF + 2 * 86400);
  assert.equal(compareRiskScore([early, crossed, late], "TRAIN").known.count, 1);
  assert.equal(compareRiskScore([early, crossed, late], "TEST").known.count, 1);
  assert.equal(compareRiskScore([early, crossed, late], "ALL").known.count, 3);
  const rows = bars();
  const list = buildScoredHints([{ code: "6758", candles: rows, opportunities: [{
    hintIndex: 65, hintTime: rows[65].time, hintTrade: null,
  }] }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].score, 0);
  assert.equal(compareRiskScore(list, "ALL").pending, 1);
  assert.equal(compareRiskScore(list, "ALL").known.count, 0);
});
