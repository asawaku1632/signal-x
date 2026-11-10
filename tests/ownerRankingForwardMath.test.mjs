import test from "node:test";
import assert from "node:assert/strict";
import { evaluateForwardReturn, verifyAdjustmentBasis } from "../app/lib/ownerRankingForwardMath.mjs";

test("rejects unverified entry/exit and factor", () => {
  for (const field of ["entryQuoteVerified", "factorVerified", "exitCloseVerified"]) {
    const params = { entryPrice: 100, entryAdjustmentFactor: 1, exitAdjustedClose: 110,
      entryQuoteVerified: true, factorVerified: true, exitCloseVerified: true, [field]: false };
    assert.equal(evaluateForwardReturn(params).status, "UNVERIFIED_PROVENANCE");
  }
});
test("normal prices: 100 to 110 is +10%", () => {
  assert.equal(evaluateForwardReturn({ entryPrice: 100, entryAdjustmentFactor: 1,
    exitAdjustedClose: 110, entryQuoteVerified: true, factorVerified: true,
    exitCloseVerified: true }).returnPct, 10);
});
test("2:1 split: entry 100 with adjusted factor 0.5 and exit 55 is +10%", () => {
  const basis = verifyAdjustmentBasis({ entryRawClose: 100, entryAdjustedClose: 50,
    entryPrice: 100, exitRawClose: 55, exitAdjustedClose: 55, verifiedCorporateActions: true });
  assert.equal(basis.verified, true);
  assert.equal(evaluateForwardReturn({ entryPrice: 100, entryAdjustmentFactor: basis.entryFactor,
    exitAdjustedClose: 55, entryQuoteVerified: true, factorVerified: true,
    exitCloseVerified: true }).returnPct, 10);
});
test("naive comparison without adjustment is forbidden", () => {
  assert.equal(evaluateForwardReturn({ entryPrice: 100, entryAdjustmentFactor: 0,
    exitAdjustedClose: 55, entryQuoteVerified: true, factorVerified: true,
    exitCloseVerified: true }).status, "INVALID_PRICE_OR_FACTOR");
});
test("corporate action review required", () => {
  assert.equal(verifyAdjustmentBasis({ entryRawClose: 100, entryAdjustedClose: 50,
    entryPrice: 100, exitRawClose: 55, exitAdjustedClose: 55,
    verifiedCorporateActions: false }).verified, false);
});
