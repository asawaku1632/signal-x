/**
 * Strict, offline adapter for J-Quants V2 /equities/bars/daily response.
 * Expected fields: Code, Date, C (unadjusted close), AdjC (adjusted close).
 * Provider credentials, licensing, trading-calendar validation, and adjustment
 * methodology are deliberately out of scope; no network or DB access.
 *
 * The output is fail-closed until an independent reviewer explicitly certifies
 * the provider, chosen price basis, and corporate-action comparability.
 */
export function adaptJQuantsV2DailyBars(payload, { certifiedComparable = false } = {}) {
  const bars = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(bars)) throw new TypeError("Expected J-Quants daily data array");
  return bars.map((bar) => {
    const code = typeof bar?.Code === "string" ? bar.Code.trim() : "";
    const date = typeof bar?.Date === "string" ? bar.Date : "";
    const adjusted = Number(bar?.AdjC);
    const close = Number.isFinite(adjusted) && adjusted > 0 ? adjusted : NaN;
    return {
      code, date, close,
      priceBasisVerified: certifiedComparable === true && code.length > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(close),
      corporateActionUnresolved: certifiedComparable !== true || !Number.isFinite(close),
      provider: "JQUANTS_V2",
      priceField: "AdjC",
    };
  });
}
