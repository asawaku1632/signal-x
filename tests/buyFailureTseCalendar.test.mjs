import test from "node:test";
import assert from "node:assert/strict";
import { resolveTseTradingDatesAfter, isTseTradingDate, isTseTargetDateReady } from "../app/lib/technicalObservation/tseMarketCalendar.ts";

function anchorAtOrBefore(date) {
  if (isTseTradingDate(date)) return date;
  for (let offset = 1; offset <= 14; offset++) {
    const prior = new Date(Date.parse(date + "T00:00:00Z") - offset * 86400000).toISOString().slice(0, 10);
    if (isTseTradingDate(prior)) return prior;
  }
  throw new Error("CALENDAR_ANCHOR_UNAVAILABLE");
}
test("Saturday signal tracks from Monday, not Saturday", () => {
  const anchor = anchorAtOrBefore("2026-10-17");
  assert.equal(anchor, "2026-10-16");
  assert.equal(resolveTseTradingDatesAfter(anchor, 1, { maxLookaheadDays: 10 })[0], "2026-10-19");
});
test("Monday JPX holiday skips to Tuesday", () => {
  const anchor = anchorAtOrBefore("2026-10-12");
  assert.equal(anchor, "2026-10-09");
  assert.equal(resolveTseTradingDatesAfter(anchor, 1, { maxLookaheadDays: 10 })[0], "2026-10-13");
});
test("checkpoint becomes ready only after JST 15:40", () => {
  assert.equal(isTseTargetDateReady("2026-10-21", new Date("2026-10-21T06:39:00Z")), false);
  assert.equal(isTseTargetDateReady("2026-10-21", new Date("2026-10-21T06:40:00Z")), true);
});
test("20 checkpoints are strictly later trading sessions", () => {
  const dates = resolveTseTradingDatesAfter("2026-10-16", 20, { maxLookaheadDays: 50 });
  assert.equal(dates.length, 20);
  assert.equal(dates[0], "2026-10-19");
  assert.ok(dates.every((date) => isTseTradingDate(date) && date > "2026-10-16"));
});
