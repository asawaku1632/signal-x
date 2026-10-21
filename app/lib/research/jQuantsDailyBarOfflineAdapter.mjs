// Research-only J-Quants daily-bar field adapter; does not fetch or verify provider data.
// Requires manually supplied matching signal reference and provenance.
// Daily closing price must not be treated as an intraday activation fill.
import { reviewIndependentPriceJson } from "./independentPriceInputAdapter.mjs";

const validPrice = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

export function reviewJQuantsDailyBarSample(input) {
  if (!input || !Array.isArray(input.rows)) throw new Error("INVALID_JQUANTS_SAMPLE");
  const rows = input.rows.map((row) => {
    const { code, tradeDate, signalReference, bar, retrievalTimestamp } = row ?? {};
    if (!bar || typeof bar !== "object" || Array.isArray(bar)) throw new Error("INVALID_JQUANTS_BAR");
    // J-Quants may represent 4/5-digit codes. Match the first four digits only when
    // the suffix is exactly 0; reject other suffixes rather than conflating securities.
    const providerCode = String(bar.Code ?? "");
    const normalizedCode = /^\d{4}0$/.test(providerCode) ? providerCode.slice(0, 4) : providerCode;
    const close = bar.AdjC;
    return {
      code, tradeDate, signalReference,
      independentClose: validPrice(close) ? close : null,
      independentCode: normalizedCode,
      independentDate: bar.Date,
      independentSource: "J-Quants equities/bars/daily AdjC (offline unverified export)",
      samePriceBasis: false, // Intraday signal vs daily adjusted close: different price basis.
      corporateActionReviewed: false, // Presence of AdjC alone does not prove full comparability.
      retrievalTimestamp,
    };
  });
  const result = reviewIndependentPriceJson(JSON.stringify({ schemaVersion: 1, rows }));
  return {
    ...result,
    sourceDataAuthenticated: false,
    caveat: "Offline supplied J-Quants-like daily bars are untrusted until provenance and entitlement are independently checked; no baseline or future return verified.",
  };
}
