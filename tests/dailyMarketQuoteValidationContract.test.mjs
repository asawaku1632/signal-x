import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/lib/learning/dailyMarketQuoteValidation.ts", import.meta.url), "utf8");

test("daily market quote validation requires provenance and matched trade date", () => {
  assert.match(source, /TRADE_DATE_MISMATCH/);
  assert.match(source, /MISSING_SOURCE/);
  assert.match(source, /INVALID_CLOSE/);
  assert.match(source, /INVALID_OBSERVED_AT/);
  assert.match(source, /OBSERVED_ON_DIFFERENT_JST_DAY/);
});

test("daily closing quotes cannot use a pre-close observation", () => {
  assert.match(source, /BEFORE_MARKET_CLOSE/);
  assert.match(source, /jstTime < "15:30"/);
});

test("live market endpoint is not referenced as a historical price source", () => {
  assert.doesNotMatch(source, /fetch\(\s*["'`]\/api\/market/);
});
