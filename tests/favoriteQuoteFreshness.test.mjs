import test from "node:test";
import assert from "node:assert/strict";
import { favoriteQuoteFreshness } from "../app/lib/favoriteQuoteFreshness.ts";

const now = new Date("2026-10-26T00:10:00Z");
const quote = (ageSeconds) => (now.getTime() / 1000) - ageSeconds;

test("recent quote is eligible", () => {
  assert.equal(favoriteQuoteFreshness(quote(180), now).ok, true);
});
test("exact five-minute boundary is eligible", () => {
  assert.equal(favoriteQuoteFreshness(quote(300), now).ok, true);
});
test("stale quote is rejected", () => {
  assert.equal(favoriteQuoteFreshness(quote(301), now).reason, "quote_too_old");
});
test("future quote is rejected", () => {
  assert.equal(favoriteQuoteFreshness(quote(-1), now).reason, "quote_timestamp_future");
});
test("missing and invalid timestamps are rejected", () => {
  for (const input of [null, undefined, "", "not-a-date", 0, -1]) {
    assert.equal(favoriteQuoteFreshness(input, now).ok, false);
  }
});
