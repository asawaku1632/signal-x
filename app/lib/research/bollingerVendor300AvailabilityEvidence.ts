/** Immutable evidence from manual Preview Yahoo Finance diagnostics, 2026-10-17.
 * These are provider 404 responses, NOT confirmed delistings.
 * Preserve the frozen 300 universe unchanged for reproducibility.
 * Exclude these codes from new forward-performance eligibility until
 * a fresh provider check and an independent listing-status review.
 */
export const BB_VENDOR_300_HTTP404_CODES = [
  "9613", "2412", "4384", "3141", "1809",
  "2651", "1949", "6028", "6201", "9719",
] as const;
export const BB_VENDOR_300_DIAGNOSTIC = {
  universeVersion: "BB_VENDOR_PROBE_300_V1",
  tested: 300,
  providerAvailable: 290,
  providerHttp404: 10,
  evidence: "OWNER_PREVIEW_READ_ONLY_TEN_404_DIAGNOSTIC",
  interpretation: "PROVIDER_UNAVAILABLE_LISTING_STATUS_UNVERIFIED",
} as const;
export function isBbVendor300Provider404(code: string): boolean {
  return (BB_VENDOR_300_HTTP404_CODES as readonly string[]).includes(code);
}
