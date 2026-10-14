/**
 * External AI watchlist audit (SHADOW ONLY).
 *
 * An old screenshot is NOT a verified pre-market prediction.
 * Daily OHLC can rule out a limit order if low > limit, but cannot
 * establish that a touched limit actually filled.
 * No DB/cron/network/portfolio/model integrations.
 */
export const EXTERNAL_AI_AUDIT_VERSION = "EXTERNAL_AI_LIMIT_AUDIT_V1";

const finitePositive = n => typeof n === "number" && Number.isFinite(n) && n > 0;
const validCode = code => /^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(String(code));
const validDate = date => typeof date === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(date + "T00:00:00Z")) &&
  new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date;
const timezoneTimestamp = s => typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s) &&
  Number.isFinite(Date.parse(s));

function marketValid(quote) {
  if (!quote || ![quote.open, quote.high, quote.low, quote.close].every(finitePositive)) return false;
  return quote.high >= Math.max(quote.open, quote.close, quote.low) &&
    quote.low <= Math.min(quote.open, quote.close, quote.high);
}

function result(status, explanation, extras = {}) {
  return {status, explanation, indicativeOnly: true, fillConfirmed: false, ...extras};
}

/**
 * forecast: {code, tradeDate, buyLimit, publishedAt, originalPostUrl,
 *   publicationVerified} -- publicationVerified means independent proof of
 *   ORIGINAL publication time, not the later screenshot capture time.
 * quote: {tradeDate, open, high, low, close, verified, sameShareBasis,
 *   source} -- completed unadjusted/split-comparable market-day OHLC.
 */
export function evaluateExternalLimitForecast(forecast, quote) {
  if (!forecast || !validCode(forecast.code) || !validDate(forecast.tradeDate) ||
      !finitePositive(forecast.buyLimit)) {
    return result("INVALID_FORECAST", "Valid JPX code, trade date and positive buy limit required.");
  }
  const basics = {code: forecast.code, tradeDate: forecast.tradeDate,
    buyLimit: forecast.buyLimit};
  if (!forecast.publicationVerified || !forecast.originalPostUrl ||
      !timezoneTimestamp(forecast.publishedAt)) {
    return result("REFERENCE_ONLY",
      "Original publication timestamp or independently checked source is missing; no historical win may be claimed.", basics);
  }
  const openTime = Date.parse(forecast.tradeDate + "T09:00:00+09:00");
  const published = Date.parse(forecast.publishedAt);
  if (published >= openTime) {
    return result("AFTER_OPEN_NEEDS_INTRADAY",
      "After-open publication cannot be scored using full-day lows: requires bars after publication.", basics);
  }
  if (published < openTime - 7 * 86400000) {
    return result("STALE_PREDICTION",
      "Publication is more than seven days before the specified trade date.", basics);
  }
  if (!quote || quote.tradeDate !== forecast.tradeDate || quote.verified !== true ||
      typeof quote.source !== "string" || !quote.source.trim() || !marketValid(quote)) {
    return result("MARKET_DATA_UNVERIFIED",
      "Completed date-matched, sourced OHLC is needed; never estimate missing bars.", basics);
  }
  if (quote.sameShareBasis !== true) {
    return result("PRICE_BASIS_UNVERIFIED",
      "Stock splits, adjusted prices or quote units must be checked before comparison.", basics);
  }
  if (quote.low > forecast.buyLimit) {
    return result("NOT_REACHED",
      "Whole-day low exceeds buy limit, so no hypothetical order would execute at this limit.",
      {...basics, dayLow: quote.low, dayClose: quote.close, grossPnl100: null});
  }
  if (quote.open <= forecast.buyLimit) {
    const grossPnl100 = Number(((quote.close - quote.open) * 100).toFixed(2));
    return result("OPEN_MARKETABLE_INDICATIVE",
      "Limit is marketable at the open. Open-price execution is hypothetical, not guaranteed.",
      {...basics, indicativeEntry: quote.open, dayClose: quote.close, grossPnl100,
        grossReturnPct: Number(((quote.close / quote.open - 1) * 100).toFixed(5))});
  }
  const grossPnl100 = Number(((quote.close - forecast.buyLimit) * 100).toFixed(2));
  return result("LIMIT_TOUCHED_UNCONFIRMED",
    "Daily low touched the limit, but OHLC cannot prove queue priority or actual fill.",
    {...basics, indicativeEntry: forecast.buyLimit, dayClose: quote.close, grossPnl100,
      grossReturnPct: Number(((quote.close / forecast.buyLimit - 1) * 100).toFixed(5))});
}

/** Never count an unfilled or unconfirmed-limit trade as a realised win. */
export function summarizeExternalCohort(rows) {
  if (!Array.isArray(rows)) throw Error("EXPECTED_RESULTS_ARRAY");
  const states = {};
  for (const row of rows) {
    const state = row && typeof row.status === "string" ? row.status : "INVALID";
    states[state] = (states[state] || 0) + 1;
  }
  const hypotheticallyMarketable = rows.filter(x => x?.status === "OPEN_MARKETABLE_INDICATIVE");
  const valid = hypotheticallyMarketable.filter(x => Number.isFinite(x.grossPnl100));
  return {
    total: rows.length,
    states,
    confirmedFills: 0,
    indicativeOpenCount: valid.length,
    indicativeOpenWinRate: valid.length ?
      100 * valid.filter(x => x.grossPnl100 > 0).length / valid.length : null,
    indicativeOpenAvgPnl100: valid.length ?
      valid.reduce((sum, x) => sum + x.grossPnl100, 0) / valid.length : null,
    sufficientEvidence: false
  };
}
