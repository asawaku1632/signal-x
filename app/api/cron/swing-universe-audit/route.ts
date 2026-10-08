import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { captureSwingUniverseDay, updateSwingUniverseOutcomes } from "@/app/lib/learning/swingUniverseAudit";
import { resolveTargetTradeDate } from "@/app/lib/technicalObservation/tseMarketCalendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// Daily 16:20 JST, after the existing 15:35 daily stock save.
// Separate observational job: NO changes to user trades, signals, weights, or notifications.
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const now = new Date();
    const { targetTradeDate } = resolveTargetTradeDate(now);
    const capture = await captureSwingUniverseDay(targetTradeDate, now);
    const outcomes = await updateSwingUniverseOutcomes(targetTradeDate);
    const result = { success: true, date: targetTradeDate, capture, outcomes,
      checkedAt: now.toISOString() };
    console.info("[swing-universe-audit]", JSON.stringify(result));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[swing-universe-audit] failed", error);
    return NextResponse.json({ success: false, error: "Daily universe audit failed" }, { status: 500 });
  }
}
