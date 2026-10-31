/**
 * Validate daily market quotes before using them in historical research.
 * This is deliberately separate from the live /api/market endpoint:
 * its undated regularMarketPrice is NOT safe for historical joins.
 */
export type DatedMarketQuote = {
  tradeDate: string;
  observedAt: string;
  source: string;
  close: number;
};

export function validateDatedMarketQuote(
  quote: DatedMarketQuote,
  expectedTradeDate: string,
): { ok: true; quote: DatedMarketQuote } | { ok: false; reason: string } {
  if (typeof quote.tradeDate !== "string") return { ok: false, reason: "INVALID_TRADE_DATE" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedTradeDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(quote.tradeDate) ||
      !Number.isFinite(Date.parse(`${quote.tradeDate}T00:00:00Z`)) ||
      new Date(`${quote.tradeDate}T00:00:00Z`).toISOString().slice(0, 10) !== quote.tradeDate) {
    return { ok: false, reason: "INVALID_TRADE_DATE" };
  }
  if (quote.tradeDate !== expectedTradeDate) {
    return { ok: false, reason: "TRADE_DATE_MISMATCH" };
  }
  if (typeof quote.source !== "string" || !quote.source.trim()) return { ok: false, reason: "MISSING_SOURCE" };
  if (!Number.isFinite(quote.close) || quote.close <= 0) {
    return { ok: false, reason: "INVALID_CLOSE" };
  }
  if (typeof quote.observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(quote.observedAt)) {
    return { ok: false, reason: "INVALID_OBSERVED_AT" };
  }
  const observed = Date.parse(quote.observedAt);
  if (!Number.isFinite(observed)) return { ok: false, reason: "INVALID_OBSERVED_AT" };
  // The quote must have been observed on its labeled JST trading day.
  const jstDate = new Date(observed + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (jstDate !== quote.tradeDate) return { ok: false, reason: "OBSERVED_ON_DIFFERENT_JST_DAY" };
  // A daily closing quote cannot be observed before the Tokyo market close (15:30 JST).
  const jstTime = new Date(observed + 9 * 60 * 60 * 1000).toISOString().slice(11, 16);
  if (jstTime < "15:30") return { ok: false, reason: "BEFORE_MARKET_CLOSE" };
  return { ok: true, quote };
}
