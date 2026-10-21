import { validateMarketIndexSnapshot, type MarketIndexKey } from "./marketIndexShadowContract";

const YAHOO_INDEX_SYMBOLS: Record<MarketIndexKey, string> = {
  nikkei: "^N225",
  topix: "^TOPX",
};

/**
 * Research only. Does not reuse /api/market's un-timestamped display price.
 * A provider result is rejected unless its identity, price and timestamp match.
 */
export async function fetchTimestampedMarketIndex(index: MarketIndexKey, capturedAt = new Date().toISOString()) {
  const symbol = YAHOO_INDEX_SYMBOLS[index];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) return { index, status: "missing" as const, reason: `HTTP ${response.status}` };
  const data = await response.json();
  const result = data?.chart?.result?.[0];
  const returnedSymbol = result?.meta?.symbol;
  if (returnedSymbol !== symbol)
    return { index, status: "invalid" as const, reason: "Provider symbol mismatch" };
  const timestamps: unknown[] = result?.timestamp ?? [];
  const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
  for (let i = timestamps.length - 1; i >= 0; i--) {
    const timestamp = timestamps[i];
    const price = closes[i];
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp) ||
        typeof price !== "number" || !Number.isFinite(price)) continue;
    return validateMarketIndexSnapshot({
      index, value: price, observedAt: new Date(timestamp * 1000).toISOString(),
      capturedAt, source: `yahoo-finance-chart:${symbol}:1m`,
    });
  }
  return { index, status: "missing" as const, reason: "No timestamped closing price" };
}
