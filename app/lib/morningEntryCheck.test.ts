import assert from "node:assert/strict";
import { test } from "node:test";
import { assessMorningEntry, type MorningEntryInput } from "./morningEntryCheck.ts";
import { estimateOvernightBuyLimit, type DailyCandle } from "./overnightBuyLimit.ts";

const now = new Date("2026-10-13T02:09:00Z"); // 11:09 JST
const ready = {
  status: "ready" as const,
  referenceDate: "2026-10-09",
  referenceClose: 3814,
  rawLimitYen: 3890,
  limitYen: 3890,
  tickSizeYen: 5,
  additionalYen: 76,
  premiumPercent: 1.99,
  gapSamples: 65,
  positiveGapSamples: 30,
};
const base: MorningEntryInput = {
  now,
  reference: ready,
  candles: [
    { time: Date.parse("2026-10-13T00:00:00Z") / 1000, open: 3814, close: 3814 },
    { time: Date.parse("2026-10-13T02:05:00Z") / 1000, open: 3817, close: 3830 },
  ],
  chartStatus: "fresh", chartUpdatedAt: "2026-10-13T02:08:00Z",
  scanStatus: "fresh", scanUpdatedAt: "2026-10-13T02:08:00Z",
  aiPower: 98.2, rsi: 68, scanPrice: 3830,
};

test("strong AI alone never produces a direct BUY recommendation", () => {
  const result = assessMorningEntry(base);
  assert.equal(result.status, "CONDITIONAL");
  assert.equal(result.label, "参考条件内・最終確認");
  assert.equal(result.limitYen, 3890);
});

test("Sony-like AI downgrade produces avoid instead of chasing", () => {
  const result = assessMorningEntry({ ...base, aiPower: 69, rsi: 20 });
  assert.equal(result.status, "AVOID");
  assert.match(result.reasons.join(" "), /AI POWER/);
});

test("intraday price drop after higher opening produces avoid", () => {
  const result = assessMorningEntry({
    ...base,
    candles: [
      { time: Date.parse("2026-10-13T00:00:00Z") / 1000, open: 3860, close: 3860 },
      { time: Date.parse("2026-10-13T02:05:00Z") / 1000, open: 3812, close: 3806 },
    ],
    aiPower: 98.2, scanPrice: 3806,
  });
  assert.equal(result.status, "AVOID");
  assert.match(result.reasons.join(" "), /寄り付き/);
});

test("limit exceeded is a no-chase warning", () => {
  const result = assessMorningEntry({ ...base, scanPrice: 3911,
    candles: [
      { time: Date.parse("2026-10-13T00:00:00Z") / 1000, open: 3860, close: 3860 },
      { time: Date.parse("2026-10-13T02:05:00Z") / 1000, open: 3901, close: 3911 },
    ] });
  assert.equal(result.status, "AVOID");
  assert.match(result.reasons.join(" "), /上限/);
});

test("mismatched scan and chart prices produce unavailable", () => {
  const result = assessMorningEntry({ ...base, scanPrice: 3814 });
  assert.equal(result.status, "UNAVAILABLE");
  assert.match(result.summary, /食い違い/);
});

test("stale scan or market bars can never return conditional", () => {
  const staleScan = assessMorningEntry({ ...base, scanStatus: "stale" });
  const staleBar = assessMorningEntry({
    ...base,
    candles: [{ time: Date.parse("2026-10-13T01:05:00Z") / 1000, open: 3814, close: 3830 }],
  });
  assert.equal(staleScan.status, "UNAVAILABLE");
  assert.equal(staleBar.status, "UNAVAILABLE");
});

test("lunch break and 9:00 before completed five-minute interval are unavailable", () => {
  assert.equal(assessMorningEntry({ ...base, now: new Date("2026-10-13T02:45:00Z") }).status, "UNAVAILABLE");
  assert.equal(assessMorningEntry({ ...base, now: new Date("2026-10-13T00:03:00Z") }).status, "UNAVAILABLE");
});

test("previous reference after daily market opens excludes unfinished bar", () => {
  const day = (date: string, open: number, close: number): DailyCandle => ({
    time: Date.parse(date + "T00:00:00Z") / 1000, open, close,
  });
  const candles: DailyCandle[] = [];
  const start = Date.parse("2026-06-22T00:00:00Z");
  for (let dayNumber = 0; dayNumber < 80; dayNumber++) {
    const d = new Date(start + dayNumber * 86_400_000);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const iso = d.toISOString().slice(0, 10);
    candles.push(day(iso, 3800 + (dayNumber % 4) * 20, 3814));
  }
  candles.push(day("2026-10-09", 3820, 3814));
  candles.push(day("2026-10-13", 3860, 3850));
  const result = estimateOvernightBuyLimit(candles, now, { forMorningRecheck: true });
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.referenceDate, "2026-10-09");
    assert.equal(result.referenceClose, 3814);
  }
});

test("a freshly refreshed API never makes a 16-minute-old candle tradable", () => {
  const result = assessMorningEntry({
    ...base,
    chartUpdatedAt: "2026-10-13T02:09:00Z",
    candles: [
      { time: Date.parse("2026-10-13T00:00:00Z") / 1000, open: 3814, close: 3814 },
      { time: Date.parse("2026-10-13T01:53:00Z") / 1000, open: 3820, close: 3830 },
    ],
  });
  assert.equal(result.status, "UNAVAILABLE");
  assert.match(result.summary, /株価データが古い/);
});

test("fresh five-minute bars cannot override stale AI snapshot", () => {
  const result = assessMorningEntry({
    ...base,
    scanUpdatedAt: "2026-10-13T02:04:00Z",
  });
  assert.equal(result.status, "UNAVAILABLE");
  assert.match(result.summary, /AI分析の更新/);
});
