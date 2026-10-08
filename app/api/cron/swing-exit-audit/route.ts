import { NextResponse } from "next/server";
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
    return NextResponse.json({ success: true, checkedAt: new Date().toISOString(), capture, outcomes });
  } catch (error) {
    console.error("[swing-exit-audit] daily audit failed", error);
    return NextResponse.json({ success: false, error: "Swing exit audit failed" }, { status: 500 });
  }
}
