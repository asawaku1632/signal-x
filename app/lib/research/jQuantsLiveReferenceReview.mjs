// Preview research only: compare one provider daily close to an explicitly supplied signal reference.
// No persistence, automatic verification, trading, or publication.
import { compareIndependentDailyReference } from "./independentPriceComparison.mjs";

export async function reviewLiveDailyReference({ apiKey, code, tradeDate, signalReference, fetchImpl = fetch }) {
  if (!/^\d{4}$/.test(code ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate ?? "") ||
      typeof signalReference !== "number" || !Number.isFinite(signalReference) || signalReference <= 0)
    return { status: "INVALID_INPUT", canPublishReturn: false };
  if (!apiKey || typeof apiKey !== "string") return { status: "KEY_NOT_CONFIGURED", canPublishReturn: false };
  const url = new URL("https://api.jquants.com/v2/equities/bars/daily");
  url.searchParams.set("code", code + "0");
  url.searchParams.set("date", tradeDate);
  try {
    const response = await fetchImpl(url, { method: "GET", headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (response.status === 429) return { status: "RATE_LIMITED", canPublishReturn: false };
    if (response.status === 401 || response.status === 403) return { status: "AUTH_REJECTED", canPublishReturn: false };
    if (!response.ok) return { status: "UPSTREAM_ERROR", canPublishReturn: false };
    const body = await response.json();
    if (!body || !Array.isArray(body.data) || body.data.length !== 1 || body.pagination_key)
      return { status: "AMBIGUOUS_RESPONSE", canPublishReturn: false };
    const bar = body.data[0];
    if (!bar || bar.Code !== code + "0" || bar.Date !== tradeDate ||
        typeof bar.C !== "number" || !Number.isFinite(bar.C) || bar.C <= 0)
      return { status: "INVALID_BAR", canPublishReturn: false };
    const comparison = compareIndependentDailyReference({
      code, tradeDate, signalReference, independentClose: bar.C, independentCode: code,
      independentDate: bar.Date, independentSource: "J-Quants v2 daily raw close (server-side)",
      samePriceBasis: false, corporateActionReviewed: false,
      retrievalTimestamp: new Date().toISOString(),
    });
    // Never return raw prices or differences from this live adapter.
    return { status: "REVIEW_REQUIRED", reasons: comparison.reasons,
      baselineVerified: false, futurePriceVerified: false, canPublishReturn: false };
  } catch {
    return { status: "NETWORK_OR_PARSE_ERROR", canPublishReturn: false };
  }
}
