import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Preview-only planning endpoint. No cron registration, DB writes, or index-price requests.
// A separate, explicitly reviewed activation change is required before scheduling.
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403 });
  }
  return NextResponse.json({
    success: true,
    mode: "DRY_RUN_ONLY",
    enabled: false,
    scheduled: false,
    timezone: "Asia/Tokyo",
    proposedTimeJst: "17:30",
    indices: ["nikkei", "topix"],
    wouldRecord: { status: "unavailable", reason: "PROVIDER_APPROVAL_REQUIRED", providerRightsVerified: false },
    devDatabaseOnly: true,
    marketDataCaptured: false,
    writesPerformed: 0,
    requiredBeforeActivation: [
      "Preview-only scheduler with independently verified authentication",
      "Development database identity verification",
      "JST date deduplication under concurrent execution",
      "Failure and retry tests",
      "Explicit activation approval",
    ],
  }, { headers: { "Cache-Control": "no-store" } });
}
