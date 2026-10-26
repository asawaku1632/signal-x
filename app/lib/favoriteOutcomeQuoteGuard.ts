import { favoriteQuoteFreshness } from "./favoriteQuoteFreshness.ts";
import { quoteDateJst } from "./marketScanGuard.ts";

export function favoriteOutcomeQuoteGuard(
  quoteTimestamp: unknown,
  marketDate: string,
  now = new Date(),
) {
  const quoteDate = quoteDateJst(quoteTimestamp);
  if (quoteDate !== marketDate) {
    return { ok: false as const, reason: "quote_not_confirmed_today" as const };
  }
  const freshness = favoriteQuoteFreshness(quoteTimestamp, now);
  if (!freshness.ok) {
    return { ok: false as const, reason: freshness.reason };
  }
  return { ok: true as const, reason: "fresh" as const };
}
