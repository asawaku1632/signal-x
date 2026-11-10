/**
 * Research-only: adjusted closes cannot be compared with an unadjusted
 * intraday entry unless the adjustment basis is independently reconciled.
 */
export function evaluateForwardReturn({
  entryPrice, entryAdjustmentFactor, exitAdjustedClose,
  entryQuoteVerified, factorVerified, exitCloseVerified,
}) {
  if (!entryQuoteVerified || !factorVerified || !exitCloseVerified) {
    return { status: "UNVERIFIED_PROVENANCE", returnPct: null };
  }
  if (![entryPrice, entryAdjustmentFactor, exitAdjustedClose].every(
    value => typeof value === "number" && Number.isFinite(value) && value > 0
  )) return { status: "INVALID_PRICE_OR_FACTOR", returnPct: null };
  const adjustedEntry = entryPrice * entryAdjustmentFactor;
  if (!Number.isFinite(adjustedEntry) || adjustedEntry <= 0) {
    return { status: "INVALID_ADJUSTED_ENTRY", returnPct: null };
  }
  return {
    status: "CALCULATED",
    adjustedEntry,
    returnPct: Math.round((exitAdjustedClose / adjustedEntry - 1) * 1e8) / 1e6,
  };
}

export function verifyAdjustmentBasis({
  entryRawClose, entryAdjustedClose, entryPrice, exitRawClose,
  exitAdjustedClose, verifiedCorporateActions,
}) {
  const values = [entryRawClose, entryAdjustedClose, entryPrice, exitRawClose, exitAdjustedClose];
  if (values.some(v => typeof v !== "number" || !Number.isFinite(v) || v <= 0)) {
    return { verified: false, reason: "MISSING_OR_INVALID_PRICE" };
  }
  if (verifiedCorporateActions !== true) {
    return { verified: false, reason: "CORPORATE_ACTIONS_NOT_VERIFIED" };
  }
  // The entry factor belongs to the *entry date*, not the exit date.
  const entryFactor = entryAdjustedClose / entryRawClose;
  const exitFactor = exitAdjustedClose / exitRawClose;
  if (![entryFactor, exitFactor].every(Number.isFinite)) {
    return { verified: false, reason: "INVALID_ADJUSTMENT_FACTOR" };
  }
  return { verified: true, entryFactor, exitFactor };
}
