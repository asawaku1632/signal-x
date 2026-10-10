import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildDailySavePriceSourceAudit } from "../app/lib/learning/dailySavePriceSourceAudit.ts";

const code = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const bar = (date, hour, minute) => Math.floor(new Date(date + "T" + hour + ":" + minute + ":00+09:00").getTime() / 1000);

test("15:35 scan summary reveals outdated bar times without rejecting the stock", () => {
  const summary = buildDailySavePriceSourceAudit({
    targetDate: "2026-10-09",
    receivedAt: "2026-10-09T15:35:35+09:00",
    scanMeta: {
      cached: true, status: "fresh", cacheAge: 5,
      updatedAt: "2026-10-09T15:35:30+09:00",
    },
    stocks: [
      { code: "9984", price: 5838, dataSource: "intraday", latestBarTimestamp: bar("2026-10-09", "15", "15") },
      { code: "4062", price: 11810, dataSource: "intraday", latestBarTimestamp: bar("2026-10-09", "15", "30") },
      { code: "4493", price: 3360, dataSource: "intraday", latestBarTimestamp: null },
      { code: "7182", price: 3247, dataSource: "daily_fallback", latestBarTimestamp: bar("2026-10-08", "15", "30") },
    ],
  });
  assert.equal(summary.stockCount, 4);
  assert.deepEqual(summary.sourceCounts, { intraday: 3, daily_fallback: 1 });
  assert.equal(summary.missingBarTimestamp, 1);
  assert.equal(summary.barsFromOtherTradingDate, 1);
  assert.equal(summary.barsMoreThan10MinOld, 2);
  assert.equal(summary.snapshotAgeSeconds, 5);
  assert.equal(summary.scanCacheAgeSeconds, 5);
  assert.deepEqual(summary.lastBarClockJstTop.slice(0, 2), [
    { time: "15:30", count: 2 }, { time: "15:15", count: 1 },
  ]);
  assert.equal(summary.sampleBars.find((r) => r.code === "9984")?.price, 5838);
  assert.equal(summary.sampleBars.find((r) => r.code === "9984")?.barTimeJst, "2026-10-09 15:15");
});
test("legacy stock payload missing timestamp produces unknown source without failing", () => {
  const summary = buildDailySavePriceSourceAudit({
    targetDate: "2026-10-09", receivedAt: "2026-10-09T15:35:35+09:00",
    scanMeta: { cached: true, updatedAt: null },
    stocks: [
      { code: "9984", price: 5838 },
      { code: "4062", dataSource: "unknown" },
    ],
  });
  assert.equal(summary.stockCount, 2);
  assert.equal(summary.missingBarTimestamp, 2);
  assert.equal(summary.medianBarAgeMinutes, null);
  assert.equal(summary.snapshotAgeSeconds, null);
  assert.equal(summary.sampleBars.length, 0);
});
test("future or invalid candle timestamps cannot be represented as stale bars", () => {
  const summary = buildDailySavePriceSourceAudit({
    targetDate: "2026-10-09", receivedAt: "2026-10-09T15:35:35+09:00",
    scanMeta: {}, stocks: [
      { code: "9984", price: 5838, dataSource: "intraday",
        latestBarTimestamp: bar("2026-10-09", "15", "40") },
      { code: "4493", price: 3400, dataSource: "daily_fallback", latestBarTimestamp: NaN },
    ],
  });
  assert.equal(summary.barAgeUnavailable, 1);
  assert.equal(summary.missingBarTimestamp, 1);
  assert.equal(summary.barsMoreThan10MinOld, 0);
  assert.equal(summary.sampleBars[0].barAgeMinutes, null);
});
test("provenance is passive: daily save still inserts unchanged stocks and price", () => {
  const route = code("app/api/learning/save-daily/route.ts");
  const analysis = code("app/lib/learning/stockAnalyzer.ts");
  const source = code("app/lib/learning/dailySavePriceSourceAudit.ts");
  assert.match(analysis, /latestBarTimestamp: chart\.latestBarTimestamp \?\? null/);
  assert.match(analysis, /dataSource: chart\.dataSource \?\? "intraday"/);
  assert.match(route, /buildDailySavePriceSourceAudit\(/);
  assert.match(route, /const result = await saveDailyStocks\(targetDate, stocks\);/);
  assert.match(route, /status: "SCAN_FINISHED"/);
  assert.match(route, /status: "SAVE_SUCCESS"/);
  assert.ok((route.match(/priceSourceAudit,/g) ?? []).length >= 2);
  assert.doesNotMatch(source, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bfetch\(|\bnotify\(/i);
  assert.doesNotMatch(source, /saveDailyStocks|runScan|sendNotification/);
});
