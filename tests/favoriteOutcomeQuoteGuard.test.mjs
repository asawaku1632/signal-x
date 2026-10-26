import test from "node:test";
import assert from "node:assert/strict";
import { favoriteOutcomeQuoteGuard } from "../app/lib/favoriteOutcomeQuoteGuard.ts";

const now = new Date("2026-10-26T00:10:00Z");
const unix = (secondsAgo) => now.getTime() / 1000 - secondsAgo;

test("same-day recent result quote is eligible", () => {
  assert.equal(favoriteOutcomeQuoteGuard(unix(60), "2026-10-26", now).ok, true);
});
test("same-day stale quote cannot settle a monitor", () => {
  assert.equal(favoriteOutcomeQuoteGuard(unix(360), "2026-10-26", now).ok, false);
});
test("prior-day quote cannot settle a monitor", () => {
  assert.equal(favoriteOutcomeQuoteGuard(unix(60), "2026-10-23", now).reason, "quote_not_confirmed_today");
});
test("missing and future timestamps cannot settle a monitor", () => {
  assert.equal(favoriteOutcomeQuoteGuard(undefined, "2026-10-26", now).ok, false);
  assert.equal(favoriteOutcomeQuoteGuard(unix(-1), "2026-10-26", now).ok, false);
});
