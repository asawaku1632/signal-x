// Research-only source comparison. Never authorizes a verified return or a trade.
const validPrice = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const validDay = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function compareIndependentDailyReference(input) {
  const { code, tradeDate, signalReference, independentClose, independentCode,
    independentDate, independentSource, samePriceBasis = false,
    corporateActionReviewed = false, retrievalTimestamp = null } = input ?? {};
  const reasons = [];
  if (!/^\d{4}$/.test(String(code ?? ""))) reasons.push("INVALID_CODE");
  if (!validDay(tradeDate)) reasons.push("INVALID_DATE");
  if (!validPrice(signalReference)) reasons.push("INVALID_SIGNAL_REFERENCE");
  if (!validPrice(independentClose)) reasons.push("INVALID_INDEPENDENT_PRICE");
  if (String(independentCode ?? "") !== String(code ?? "")) reasons.push("CODE_MISMATCH");
  if (independentDate !== tradeDate) reasons.push("DATE_MISMATCH");
  if (typeof independentSource !== "string" || independentSource.trim().length === 0) reasons.push("SOURCE_UNDOCUMENTED");
  if (samePriceBasis !== true) reasons.push("PRICE_BASIS_UNCONFIRMED");
  if (corporateActionReviewed !== true) reasons.push("CORPORATE_ACTION_UNREVIEWED");
  if (!retrievalTimestamp || !Number.isFinite(Date.parse(retrievalTimestamp))) reasons.push("RETRIEVAL_TIME_MISSING");
  const differenceYen = validPrice(signalReference) && validPrice(independentClose)
    ? independentClose - signalReference : null;
  const differencePct = differenceYen !== null ? 100 * differenceYen / signalReference : null;
  return {
    code: String(code ?? ""), tradeDate, independentSource: independentSource ?? null,
    differenceYen, differencePct, reasons,
    comparisonStatus: reasons.length ? "REVIEW_REQUIRED" : "COMPARABLE_FOR_MANUAL_REVIEW",
    baselineVerified: false,
    futurePriceVerified: false,
    canPublishReturn: false,
    caveat: "Comparable references are not verified activation fills; explicit separate verification is required.",
  };
}
