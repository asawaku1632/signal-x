import assert from "node:assert/strict";
import test from "node:test";
import { calculateStockOutcomeRates } from "../app/lib/learning/stockWinRateMath.ts";

test("headline directional rate differs from actual +2% count over all settled observations", () => {
  assert.deepEqual(calculateStockOutcomeRates(22, 4, 52), {
    judged: 26,
    settled: 78,
    winRate: 84.6,
    winAmongAllRate: 28.2,
  });
});

test("HOLD-only samples never get an artificial 0% directional win rate", () => {
  assert.deepEqual(calculateStockOutcomeRates(0, 0, 12), {
    judged: 0,
    settled: 12,
    winRate: null,
    winAmongAllRate: 0,
  });
});

test("unobserved and invalid counts are not advertised as firm results", () => {
  assert.deepEqual(calculateStockOutcomeRates(0, 0, 0), {
    judged: 0,
    settled: 0,
    winRate: null,
    winAmongAllRate: null,
  });
  assert.throws(() => calculateStockOutcomeRates(-1, 2, 3), /Invalid stock outcome count/);
  assert.throws(() => calculateStockOutcomeRates(1, Number.NaN, 3), /Invalid stock outcome count/);
});
