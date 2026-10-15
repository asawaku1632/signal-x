import { NextResponse } from "next/server";
import { updatePostSaleOutcomes } from "@/app/lib/research/ownerPostSaleAudit";
import { shouldRunReboundOnHost } from "@/app/lib/research/supportReboundAutoCore";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { captureSwingExitSignals, updateSwingExitOutcomes } from "@/app/lib/learning/swingExitAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// Runs only with the server-side CRON_SECRET or NOTIFICATION_RUNNER_SECRET.
// This never sends trades or notifications, nor changes the purchase/exit logic.
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const capture = await captureSwingExitSignals();
    const outcomes = await updateSwingExitOutcomes();
    // Append isolated owner-only real-exit research after existing audit.
    // A missing migration must never break the existing EXIT workflow.
    let postSale: Record<string, unknown> = { skipped: true, reason: "NOT_PRIMARY_PRODUCTION_HOST" };
    if (shouldRunReboundOnHost(new URL(request.url).hostname, process.env.VERCEL_ENV)) {
      try { postSale = await updatePostSaleOutcomes(); }
      catch (postSaleError) {
        console.error("[owner-post-sale] optional audit failed", postSaleError);
        postSale = { skipped: true, reason: "POST_SALE_AUDIT_UNAVAILABLE" };
      }
    }
    return NextResponse.json({ success: true, checkedAt: new Date().toISOString(), capture, outcomes, postSale });
  } catch (error) {
    console.error("[swing-exit-audit] daily audit failed", error);
    return NextResponse.json({ success: false, error: "Swing exit audit failed" }, { status: 500 });
  }
}
