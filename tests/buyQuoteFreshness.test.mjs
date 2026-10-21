import test from "node:test";
import assert from "node:assert/strict";
import { buyQuoteFreshness } from "../app/lib/buyQuoteFreshness.mjs";

const now = Date.parse("2026-10-21T01:35:00Z");
const scan = { status: "fresh", updatedAt: new Date(now - 30_000).toISOString() };
const stock = { dataSource: "intraday", latestBarTimestamp: (now - 4 * 60_000) / 1000 };

test("recent intraday Yahoo bar passes", () => {
  assert.deepEqual(buyQuoteFreshness(stock, scan, now), { ok: true, reason: "fresh" });
});
test("16-minute-old bar is blocked even with fresh snapshot", () => {
  assert.equal(buyQuoteFreshness({ ...stock, latestBarTimestamp: (now - 16 * 60_000) / 1000 }, scan, now).reason, "quote_stale_or_future");
});
test("daily fallback cannot trigger intraday buy", () => {
  assert.equal(buyQuoteFreshness({ ...stock, dataSource: "daily_fallback" }, scan, now).reason, "quote_not_intraday");
});
test("unknown and future timestamps are blocked", () => {
  assert.equal(buyQuoteFreshness({ ...stock, latestBarTimestamp: null }, scan, now).reason, "quote_time_unknown");
  assert.equal(buyQuoteFreshness({ ...stock, latestBarTimestamp: (now + 60_000) / 1000 }, scan, now).reason, "quote_stale_or_future");
});
test("stale scan snapshot is blocked despite fresh candle", () => {
  assert.equal(buyQuoteFreshness(stock, { ...scan, status: "stale" }, now).reason, "scan_stale");
});
test("missing provenance is blocked", () => {
  assert.equal(buyQuoteFreshness({ latestBarTimestamp: stock.latestBarTimestamp }, scan, now).reason, "quote_not_intraday");
});
