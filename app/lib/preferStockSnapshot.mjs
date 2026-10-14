/**
 * Choose display data by the underlying Yahoo market-bar timestamp, not by
 * the time a cache write happened. A just-saved snapshot can carry old prices.
 * When the bars are the same, use the full-market row so Favorites and
 * Analysis show the same calculated score / reference price.
 *
 * @template T
 * @param {T | null | undefined} individual
 * @param {T | null | undefined} market
 * @returns {T | null}
 */
export function preferStockSnapshot(individual, market) {
  if (!individual) return market ?? null;
  if (!market) return individual;

  const quoteTimestamp = (snapshot) => {
    const raw = snapshot?.payload?.latestBarTimestamp;
    const n = raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const individualQuoteAt = quoteTimestamp(individual);
  const marketQuoteAt = quoteTimestamp(market);

  if (individualQuoteAt !== null && marketQuoteAt !== null) {
    return marketQuoteAt >= individualQuoteAt ? market : individual;
  }
  if (marketQuoteAt !== null) return market;
  if (individualQuoteAt !== null) return individual;

  const individualSavedAt = Date.parse(individual.updatedAt ?? "") || 0;
  const marketSavedAt = Date.parse(market.updatedAt ?? "") || 0;
  return marketSavedAt >= individualSavedAt ? market : individual;
}
