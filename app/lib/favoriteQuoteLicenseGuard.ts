/**
 * Trading-related notifications require explicit, independently licensed
 * quote provenance. Yahoo chart values ("intraday" and "daily_fallback")
 * are research-only and must never satisfy this gate.
 *
 * No provider is approved yet. Enable a provider only after contract,
 * attribution, timestamp semantics and redistribution rights are reviewed.
 */
export function favoriteQuoteLicenseGuard(_source: unknown) {
  return { ok: false as const, reason: "licensed_quote_provider_not_configured" as const };
}
