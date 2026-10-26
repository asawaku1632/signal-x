import test from "node:test";
import assert from "node:assert/strict";
import { favoriteQuoteLicenseGuard } from "../app/lib/favoriteQuoteLicenseGuard.ts";

test("Yahoo intraday research quotes cannot trigger trading alerts", () => {
  assert.equal(favoriteQuoteLicenseGuard("intraday").ok, false);
});
test("Yahoo daily fallback cannot trigger trading alerts", () => {
  assert.equal(favoriteQuoteLicenseGuard("daily_fallback").ok, false);
});
test("unknown and forged licensed sources fail closed until provider approval", () => {
  assert.equal(favoriteQuoteLicenseGuard(null).ok, false);
  assert.equal(favoriteQuoteLicenseGuard("licensed").ok, false);
});
