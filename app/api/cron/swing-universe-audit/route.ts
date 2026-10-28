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
    const { targetTradeDate, targetTradeDateReason } = resolveTargetTradeDate(now);
    // Prevent retroactive observations during pre-close and market holidays.
    // Deliberate historical replay requires a separately reviewed workflow.
    const capture = targetTradeDateReason === "CURRENT_TSE_TRADING_DAY_AFTER_SAFE_BOUNDARY"
      ? await captureSwingUniverseDay(targetTradeDate, now)
      : { date: targetTradeDate, saved: 0, eligible: 0, skipped: "NON_CURRENT_TRADE_DATE" };
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
