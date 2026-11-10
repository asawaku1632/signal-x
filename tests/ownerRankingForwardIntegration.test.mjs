import test from "node:test";
import assert from "node:assert/strict";
import { evaluateForwardReturn, verifyAdjustmentBasis } from "../app/lib/ownerRankingForwardMath.mjs";

const verified = { entryQuoteVerified: true, factorVerified: true, exitCloseVerified: true };
test("unverified entry/exit provenance is rejected", () => {
  for (const key of Object.keys(verified)) {
    assert.equal(evaluateForwardReturn({ entryPrice: 100, entryAdjustmentFactor: 1,
      exitAdjustedClose: 110, ...verified, [key]: false }).status, "UNVERIFIED_PROVENANCE");
  }
});
test("normal +10% return", () => {
  assert.equal(evaluateForwardReturn({ entryPrice: 100, entryAdjustmentFactor: 1,
    exitAdjustedClose: 110, ...verified }).returnPct, 10);
});
test("2-for-1 split: adjusted entry 50, exit 55 = +10%", () => {
  const basis = verifyAdjustmentBasis({ entryRawClose: 100, entryAdjustedClose: 50,
    entryPrice: 100, exitRawClose: 55, exitAdjustedClose: 55, verifiedCorporateActions: true });
  assert.equal(basis.verified, true);
  assert.equal(evaluateForwardReturn({ entryPrice: 100, entryAdjustmentFactor: basis.entryFactor,
    exitAdjustedClose: 55, ...verified }).returnPct, 10);
});
test("rejects invalid prices and uncertified actions", () => {
  assert.equal(evaluateForwardReturn({ entryPrice: 100, entryAdjustmentFactor: 0,
    exitAdjustedClose: 55, ...verified }).status, "INVALID_PRICE_OR_FACTOR");
  assert.equal(verifyAdjustmentBasis({ entryRawClose: 100, entryAdjustedClose: 50,
    entryPrice: 100, exitRawClose: 55, exitAdjustedClose: 55,
    verifiedCorporateActions: false }).verified, false);
});
