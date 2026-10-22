import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner-only, Preview-only, read-only integrity check. Not independent price verification.
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, status: "ADMIN_REQUIRED" }, { status: 403, headers });
  if (process.env.VERCEL_ENV !== "preview" || process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true") {
    return NextResponse.json({ success: false, status: "PROBE_DISABLED" }, { status: 403, headers });
  }
  const apiKey = process.env.JQUANTS_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, status: "KEY_NOT_CONFIGURED" }, { headers });
  const code = "39960", date = "2026-07-01";
  const url = new URL("https://api.jquants.com/v2/equities/bars/daily");
  url.searchParams.set("code", code);
  url.searchParams.set("date", date);
  let status = "NETWORK_OR_PARSE_ERROR";
  try {
    const response = await fetch(url, { headers: { "x-api-key": apiKey }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (response.status === 401 || response.status === 403) status = "AUTH_OR_ENTITLEMENT_REJECTED";
    else if (response.status === 429) status = "RATE_LIMITED";
    else if (!response.ok) status = "UPSTREAM_ERROR";
    else {
      const body = await response.json();
      if (!body || !Array.isArray(body.data) || body.data.length !== 1 || body.pagination_key) status = "INVALID_RESPONSE";
      else {
        const bar = body.data[0];
        const valid = bar && bar.Code === code && bar.Date === date &&
          ["O", "H", "L", "C"].every(k => typeof bar[k] === "number" && Number.isFinite(bar[k]) && bar[k] > 0);
        if (!valid) status = "INVALID_BAR_FIELDS";
        else if (bar.H < Math.max(bar.O, bar.C, bar.L) || bar.L > Math.min(bar.O, bar.C, bar.H)) status = "OHLC_INCONSISTENT";
        else status = "BAR_INTERNAL_CONSISTENCY_PASSED";
      }
    }
  } catch { /* fail closed; do not log credentials or market data */ }
  return NextResponse.json({
    success: status === "BAR_INTERNAL_CONSISTENCY_PASSED",
    status,
    internalConsistencyChecked: status === "BAR_INTERNAL_CONSISTENCY_PASSED",
    priceVerified: false,
    independentSourceCompared: false,
    publishableReturn: false,
  }, { headers });
}
