import { verifyResearchSchedulerToken } from "@/app/lib/researchSchedulerAuth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Dedicated scheduler authentication, isolated from admin sessions and CRON_SECRET.
// This route is deliberately read-only and cannot activate scheduled writes.
export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ success: false, reason: "PREVIEW_ONLY" }, { status: 403 });
  }
  const auth = verifyResearchSchedulerToken(
    request.headers.get("authorization") ?? "",
    process.env.MARKET_INDEX_RESEARCH_PREVIEW_CRON_SECRET
  );
  if (auth === "NOT_CONFIGURED")
    return NextResponse.json({ success: false, reason: "SCHEDULER_SECRET_NOT_CONFIGURED" }, { status: 503 });
  if (auth !== "AUTHORIZED")
    return NextResponse.json({ success: false, reason: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({
    success: true,
    mode: "AUTHENTICATED_DRY_RUN",
    schedulerEnabled: false,
    writesPerformed: 0,
    marketDataCaptured: false,
    timezone: "Asia/Tokyo",
    proposedTimeJst: "17:30",
    indices: ["nikkei", "topix"],
  }, { headers: { "Cache-Control": "no-store" } });
}
