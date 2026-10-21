// Server-side research-only probe. No API key, response body, or raw price logging.
// No database writes, trade actions, notifications, or verification claims.
const ENDPOINT = "https://api.jquants.com/v2/equities/bars/daily";
export async function probeJQuantsHistoricalDailyBar({ apiKey, code, date, fetchImpl = fetch }) {
  if (typeof apiKey !== "string" || !apiKey.trim()) return { status: "KEY_NOT_CONFIGURED" };
  if (!/^\d{4}$/.test(code) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { status: "INVALID_INPUT" };
  const url = new URL(ENDPOINT);
  url.searchParams.set("code", code + "0");
  url.searchParams.set("date", date);
  try {
    const response = await fetchImpl(url, {
      method: "GET", headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(8000), cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) return { status: "AUTH_OR_ENTITLEMENT_REJECTED" };
    if (response.status === 429) return { status: "RATE_LIMITED" };
    if (!response.ok) return { status: "UPSTREAM_ERROR" };
    const body = await response.json();
    if (!body || !Array.isArray(body.data) || body.pagination_key) return { status: "INVALID_RESPONSE" };
    const rows = body.data.filter(bar => bar && bar.Code === code + "0" && bar.Date === date);
    if (rows.length !== 1 || body.data.length !== 1) return { status: "NO_UNAMBIGUOUS_BAR" };
    const bar = rows[0];
    if (typeof bar.C !== "number" || !Number.isFinite(bar.C) || bar.C <= 0) return { status: "INVALID_CLOSE" };
    const adjustedCloseAvailable = typeof bar.AdjC === "number" && Number.isFinite(bar.AdjC) && bar.AdjC > 0;
    // Diagnostic metadata only. No prices, source body, or verification flags are exposed.
    return { status: "HISTORICAL_BAR_PRESENT", adjustedCloseAvailable, priceVerified: false, publishableReturn: false };
  } catch {
    return { status: "NETWORK_OR_PARSE_ERROR" };
  }
}
