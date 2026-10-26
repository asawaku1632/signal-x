/**
 * Fail-closed policy for price-triggered user notifications.
 * A fresh Yahoo candle is not evidence of licensed redistribution rights.
 */
export function favoriteQuoteLicenseGuard(_source: unknown) {
  return { ok: false as const, reason: "licensed_quote_provider_not_configured" as const };
}

export async function withLicensedQuoteNotification<T>(
  source: unknown,
  dispatch: () => Promise<T>,
): Promise<{ dispatched: false; reason: "licensed_quote_provider_not_configured" } | { dispatched: true; result: T }> {
  const license = favoriteQuoteLicenseGuard(source);
  if (!license.ok) return { dispatched: false, reason: license.reason };
  return { dispatched: true, result: await dispatch() };
}
