import assert from "node:assert/strict";
import test from "node:test";
import { studySupportRebounds } from "../app/lib/supportReboundResearch.ts";

const bar = (i, open, close, low = Math.min(open, close) - 0.5, high = Math.max(open, close) + 0.5) =>
  ({ time: 1700000000 + i * 86400, open, close, low, high, volume: 1000 });
function setup({ confirm = true } = {}) {
  const bars = Array.from({ length: 23 }, (_, i) => bar(i, 104, 104, 103.5, 104.5));
  bars.push(bar(23, 102, 102, 101, 103));
  bars.push(bar(24, 100, 100, 99, 101));
  bars.push(bar(25, 98, 98, 97, 99));
  bars.push(bar(26, 97, 97.25, 96.5, 98));
  bars.push(confirm ? bar(27, 97.1, 98.5, 96.8, 99) : bar(27, 97.1, 96, 95, 98));
  bars.push(bar(28, 98, 99, 97.5, 100));
  for (let i = 29; i < 45; i++) bars.push(bar(i, 99 + (i - 29) / 3, 99 + (i - 29) / 3));
  return bars;
}
test("③ and ② use successive close signals and next-day opens, without lookahead", () => {
  const candles = setup(), result = studySupportRebounds(candles);
  assert.equal(result.hintCount, 1);
  assert.equal(result.confirmedCount, 1);
  assert.equal(result.paired.count, 1);
  assert.equal(result.opportunities[0].hintTime, candles[26].time);
  assert.equal(result.opportunities[0].confirmedTime, candles[27].time);
  assert.equal(result.opportunities[0].hintTrade.entryPrice, candles[27].open);
  assert.equal(result.opportunities[0].confirmedTrade.entryPrice, candles[28].open);
  assert.equal(result.opportunities[0].hintTrade.exitPrice, candles[32].open);
});
test("failed rebound stays only in ③, not counted as a confirmed trade", () => {
  const result = studySupportRebounds(setup({ confirm: false }));
  assert.equal(result.hintCount, 1);
  assert.equal(result.confirmedCount, 0);
  assert.equal(result.confirmations.winRatePercent, null);
});
test("incomplete outcomes remain pending, not wins or losses", () => {
  const result = studySupportRebounds(setup().slice(0, 30), { holdBars: 10 });
  assert.equal(result.hintCount, 1);
  assert.equal(result.confirmedCount, 1);
  assert.equal(result.pendingHintOutcomes, 1);
  assert.equal(result.pendingConfirmedOutcomes, 1);
  assert.equal(result.hints.count, 0);
});
test("a split in the test period excludes the entire setup", () => {
  const candles = setup();
  assert.equal(studySupportRebounds(candles, { splitEvents: [candles[29].time] }).hintCount, 0);
});
test("invalid parameters fail rather than invent outcomes", () => {
  assert.throws(() => studySupportRebounds(setup(), { holdBars: 0 }), /INVALID_HOLD_BARS/);
  assert.throws(() => studySupportRebounds(setup(), { shares: 0 }), /INVALID_SHARES/);
});
