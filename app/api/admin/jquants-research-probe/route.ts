import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { isAuthorizedResearchOwner, RESEARCH_PRIVATE_HEADERS } from "@/app/lib/research/ownerPreviewPolicy.mjs";
import { probeJQuantsHistoricalDailyBar } from "@/app/lib/research/jQuantsHistoricalProbe.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

// Intentionally fixed historical sample. No user-provided URL, ticker or date.
export async function POST() {
  const { isAdmin } = await getAdminSession();
  if (!isAuthorizedResearchOwner(isAdmin)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403, headers: RESEARCH_PRIVATE_HEADERS });
  }
  if (process.env.VERCEL_ENV !== "preview" || process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true") {
    return NextResponse.json({ success: false, status: "RESEARCH_PROBE_DISABLED" }, { status: 403, headers: RESEARCH_PRIVATE_HEADERS });
  }
  const result = await probeJQuantsHistoricalDailyBar({
    apiKey: process.env.JQUANTS_API_KEY,
    code: "3996",
    date: "2026-07-01",
  });
  return NextResponse.json({
    success: result.status === "HISTORICAL_BAR_PRESENT",
    mode: "OWNER_PREVIEW_READ_ONLY_JQUANTS_CONNECTION_PROBE",
    ...result,
  }, { headers: RESEARCH_PRIVATE_HEADERS });
}
