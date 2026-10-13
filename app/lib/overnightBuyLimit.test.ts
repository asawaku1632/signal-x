import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateOvernightBuyLimit, type DailyCandle } from "./overnightBuyLimit.ts";

function dailyCandles(lastDay = Date.UTC(2026, 9, 9, 0, 0, 0)): DailyCandle[] {
  const rows: DailyCandle[] = [];
  for (let time = lastDay; rows.length < 72; time -= 86_400_000) {
    const weekday = new Date(time).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const gap = rows.length % 3 === 0 ? 0.025 : rows.length % 3 === 1 ? 0.01 : -0.005;
    rows.push({ time: time / 1000, open: 3814 * (1 + gap), close: 3814 });
  }
  return rows.reverse();
}

test("pre-open: capped historical premium is a limit, not a guaranteed execution price", () => {
  const result = estimateOvernightBuyLimit(dailyCandles(), new Date("2026-10-12T20:10:00Z"));
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.referenceDate, "2026-10-09");
  assert.equal(result.referenceClose, 3814);
  assert.equal(result.limitYen, 3890); // 2% cap, not 3914 by default
  assert.equal(result.gapSamples, 71);
  assert.ok(result.positiveGapSamples >= 8);
});


test("3,219 yen raw upper limit is preserved, while display/order reference is 3,215", () => {
  const candles = dailyCandles().map((candle, i) => {
    const gap = i % 3 === 0 ? 0.014 : i % 3 === 1 ? 0.005 : -0.005;
    return { ...candle, close: 3175, open: 3175 * (1 + gap) };
  });
  const result = estimateOvernightBuyLimit(candles, new Date("2026-10-12T20:10:00Z"));
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.referenceClose, 3175);
  assert.equal(result.rawLimitYen, 3219);
  assert.equal(result.limitYen, 3215);
  assert.equal(result.tickSizeYen, 5);
  assert.equal(result.additionalYen, 40);
  assert.equal(result.limitYen * 100, 321500);
  assert.ok(result.limitYen <= result.rawLimitYen);
});

test("cash-market session: never show a stale overnight reference as today's order price", () => {
  assert.deepEqual(
    estimateOvernightBuyLimit(dailyCandles(), new Date("2026-10-13T00:13:00Z")),
    { status: "market_open" },
  );
});

test("outdated data and too few samples fail closed", () => {
  assert.deepEqual(
    estimateOvernightBuyLimit(dailyCandles(), new Date("2026-10-27T00:00:00Z")),
    { status: "stale" },
  );
  assert.deepEqual(
    estimateOvernightBuyLimit(dailyCandles().slice(-4), new Date("2026-10-12T20:10:00Z")),
    { status: "insufficient_data" },
  );
});

test("unfinished daily bar is excluded; completed bar after the closing buffer is included", () => {
  const newer = [
    ...dailyCandles(),
    { time: Date.UTC(2026, 9, 13, 0, 0, 0) / 1000, open: 3860, close: 3854 },
  ];
  const before = estimateOvernightBuyLimit(newer, new Date("2026-10-12T23:30:00Z"));
  assert.equal(before.status, "ready");
  if (before.status === "ready") assert.equal(before.referenceDate, "2026-10-09");

  const after = estimateOvernightBuyLimit(newer, new Date("2026-10-13T07:00:00Z"));
  assert.equal(after.status, "ready");
  if (after.status === "ready") {
    assert.equal(after.referenceDate, "2026-10-13");
    assert.equal(after.referenceClose, 3854);
  }
});
