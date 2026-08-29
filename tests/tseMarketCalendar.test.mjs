import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTargetTradeDate,
  TSE_MARKET_CALENDAR,
  TseMarketCalendarError,
} from "../app/lib/technicalObservation/tseMarketCalendar.ts";

const resolve = (iso) => resolveTargetTradeDate(new Date(iso));

test("trading-day safe boundary selects previous or current TSE date", () => {
  assert.equal(resolve("2026-08-28T06:39:59Z").targetTradeDate, "2026-08-27");
  assert.equal(resolve("2026-08-28T06:40:00Z").targetTradeDate, "2026-08-28");
  assert.equal(resolve("2026-08-28T06:40:01Z").targetTradeDate, "2026-08-28");
});

test("15:30 candle completion alone is not early enough for the 15:40 safety boundary", () => {
  assert.equal(resolve("2026-08-28T06:29:59Z").targetTradeDate, "2026-08-27");
  assert.equal(resolve("2026-08-28T06:30:01Z").targetTradeDate, "2026-08-27");
});

test("Saturday and Sunday resolve to the previous TSE trading date", () => {
  assert.equal(resolve("2026-08-29T11:02:55Z").targetTradeDate, "2026-08-28");
  assert.equal(resolve("2026-08-30T03:00:00Z").targetTradeDate, "2026-08-28");
});

test("Monday before and after the boundary resolve deterministically", () => {
  assert.equal(resolve("2026-08-31T06:39:59Z").targetTradeDate, "2026-08-28");
  assert.equal(resolve("2026-08-31T06:40:00Z").targetTradeDate, "2026-08-31");
});

test("JPX holidays and the morning after a holiday use the previous TSE trading date", () => {
  assert.equal(resolve("2026-08-11T07:00:00Z").targetTradeDate, "2026-08-10");
  assert.equal(resolve("2026-08-12T06:39:59Z").targetTradeDate, "2026-08-10");
});

test("consecutive year-end closure resolves to the final TSE trading date", () => {
  assert.equal(resolve("2027-01-03T03:00:00Z").targetTradeDate, "2026-12-30");
});

test("UTC and JST calendar dates are separated correctly", () => {
  const result = resolve("2026-08-28T16:00:00Z");
  assert.match(result.runNowJst, /^2026-08-29T01:00:00\+09:00$/);
  assert.equal(result.targetTradeDate, "2026-08-28");
});

test("missing calendar and coverage outside the versioned range fail closed", () => {
  assert.throws(() => resolveTargetTradeDate(new Date("2026-08-28T07:00:00Z"), { calendar: null }),
    (error) => error instanceof TseMarketCalendarError && error.code === "MARKET_CALENDAR_UNAVAILABLE");
  assert.throws(() => resolve("2025-12-31T07:00:00Z"),
    (error) => error instanceof TseMarketCalendarError && error.code === "MARKET_CALENDAR_UNAVAILABLE");
  assert.throws(() => resolve("2028-01-01T07:00:00Z"),
    (error) => error instanceof TseMarketCalendarError && error.code === "MARKET_CALENDAR_UNAVAILABLE");
});

test("bounded backward search fails closed when no trading date is resolvable", () => {
  const calendar = { ...TSE_MARKET_CALENDAR, closedDates: new Set([
    ...TSE_MARKET_CALENDAR.closedDates, "2026-08-27", "2026-08-28",
  ]) };
  assert.throws(() => resolveTargetTradeDate(new Date("2026-08-29T11:02:55Z"),
    { calendar, maxLookbackDays: 2 }),
  (error) => error instanceof TseMarketCalendarError && error.code === "TARGET_TRADE_DATE_UNRESOLVED");
});
