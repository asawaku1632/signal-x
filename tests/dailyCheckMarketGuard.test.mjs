import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isSafeDailyCheckPair } from "../app/lib/learning/dailyCheckMarketGuard.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("full next-trading-day stock snapshots are comparable", () => {
  assert.equal(isSafeDailyCheckPair({targetDate:"2026-10-06",priceDate:"2026-10-07",targetCount:953,futurePriceCount:953}),true);
});
test("20-stock next-day snapshots cannot decide full daily records", () => {
  assert.equal(isSafeDailyCheckPair({targetDate:"2026-08-12",priceDate:"2026-08-13",targetCount:960,futurePriceCount:20}),false);
});
test("missing next TSE session cannot be replaced with a later date", () => {
  assert.equal(isSafeDailyCheckPair({targetDate:"2026-08-12",priceDate:"2026-08-14",targetCount:960,futurePriceCount:959}),false);
  assert.equal(isSafeDailyCheckPair({targetDate:"2026-10-06",priceDate:"2026-10-08",targetCount:953,futurePriceCount:953}),false);
});
test("Japan market holiday is accounted for", () => {
  assert.equal(isSafeDailyCheckPair({targetDate:"2026-10-09",priceDate:"2026-10-13",targetCount:953,futurePriceCount:953}),true);
});
test("partial source day and unknown calendar dates are rejected", () => {
  assert.equal(isSafeDailyCheckPair({targetDate:"2026-08-13",priceDate:"2026-08-14",targetCount:20,futurePriceCount:959}),false);
  assert.equal(isSafeDailyCheckPair({targetDate:"2025-11-12",priceDate:"2025-11-13",targetCount:953,futurePriceCount:953}),false);
});
test("runner uses explicit protection without halting on a single missing price", () => {
  const source=read("app/lib/learning/checkDailyRunner.ts");
  assert.match(source,/isSafeDailyCheckPair/);
  assert.match(source,/target_stats\.saved_count/);
  assert.match(source,/future_stats\.priced_count/);
  assert.doesNotMatch(source,/stopReason = "incomplete_price_coverage"/);
  assert.match(source,/awaiting missing exact-next-day prices/);
  assert.match(source,/pg_try_advisory_xact_lock/);
  assert.match(source,/daily\.result = 'UNKNOWN'/);
});
