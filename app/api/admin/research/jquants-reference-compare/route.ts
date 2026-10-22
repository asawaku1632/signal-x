import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { compareHistoricalBar } from "@/app/lib/research/jquants-reference-compare";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Reference: Matsui Securities daily bars and Minkabu daily bars, 3996, 2026-07-01.
// Both publicly display O=173 H=175 L=173 C=175 Volume=7000.
// This is a manually fixed research fixture, not a live independent provider API.
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, status: "ADMIN_REQUIRED" }, { status: 403, headers });
  if (process.env.VERCEL_ENV !== "preview" || process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true") {
    return NextResponse.json({ success: false, status: "PROBE_DISABLED" }, { status: 403, headers });
  }
  if (!process.env.JQUANTS_API_KEY) return NextResponse.json({ success: false, status: "KEY_NOT_CONFIGURED" }, { headers });
  const url = new URL("https://api.jquants.com/v2/equities/bars/daily");
  url.searchParams.set("code", "39960");
  url.searchParams.set("date", "2026-07-01");
  let status = "NETWORK_OR_PARSE_ERROR";
  try {
    const response = await fetch(url, { headers: { "x-api-key": process.env.JQUANTS_API_KEY }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (response.status === 401 || response.status === 403) status = "AUTH_OR_ENTITLEMENT_REJECTED";
    else if (response.status === 429) status = "RATE_LIMITED";
    else if (!response.ok) status = "UPSTREAM_ERROR";
    else {
      const body = await response.json();
      if (!body || !Array.isArray(body.data) || body.data.length !== 1 || body.pagination_key) status = "INVALID_RESPONSE";
      else {
        const bar = body.data[0];
        status = compareHistoricalBar(bar);
      }
    }
  } catch { /* fail closed, no provider payload or secret logs */ }
  return NextResponse.json({
    success: status === "REFERENCE_MATCH",
    status,
    sourceType: "manually-recorded-public-reference",
    checkedFields: ["O", "H", "L", "C", "Vo"],
    referenceUrls: ["https://finance.matsui.co.jp/stock/3996/daily_bar/index", "https://minkabu.jp/stock/3996/daily_bar?page=4"],
    referenceFixtureMatched: status === "REFERENCE_MATCH",
    independentlyCompared: false,
    priceVerified: false,
    publishableReturn: false,
  }, { headers });
}
