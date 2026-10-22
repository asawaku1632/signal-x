import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { probeJQuantsHistoricalDailyBar } from "@/app/lib/research/jQuantsHistoricalProbe.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Isolated owner-only Preview probe: never returns credentials, raw prices, or provider payloads.
// No database writes, production traffic, notifications, trading, or scheduled execution.
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ success: false, status: "ADMIN_REQUIRED" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (process.env.VERCEL_ENV !== "preview" || process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true") {
    return NextResponse.json({ success: false, status: "PROBE_DISABLED" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const result = await probeJQuantsHistoricalDailyBar({
    apiKey: process.env.JQUANTS_API_KEY ?? "",
    code: "3996",
    date: "2026-07-01",
  });
  return NextResponse.json({ success: result.status === "HISTORICAL_BAR_PRESENT", ...result }, { headers: { "Cache-Control": "no-store" } });
}
