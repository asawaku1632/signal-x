import { NextResponse } from "next/server";
import { runShadowCandleAutoDaily } from "@/app/lib/research/shadowCandleAutoRunner";
import { selectShadowAutoDailyStocks } from "@/app/lib/research/shadowCandleAutoPolicy";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

/**
 * UTC 23:35 Sun-Thu == JST 08:35 Mon-Fri.
 * Feature is fail-closed: add production env SHADOW_CANDLE_AUTO_ENABLED=true
 * only AFTER migration, tests, and owner dashboard verification.
 * Cron never calls AI analysis, notifications or portfolio trades.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.SHADOW_CANDLE_AUTO_ENABLED !== "true") {
    return NextResponse.json({ success: true, skipped: true, reason: "FEATURE_DISABLED" });
  }
  // Fail closed on holidays/outside safe window before ANY SQL or Yahoo access.
  const preflight = selectShadowAutoDailyStocks({
    now: new Date(),
    universe: ACTIVE_STOCKS.map(s => s.code),
    coveredCodes: new Set(),
  });
  if (!preflight.ok) {
    return NextResponse.json({ success: true, skipped: true, dateJst: preflight.dateJst, reason: preflight.reason });
  }
  try {
    const result = await runShadowCandleAutoDaily();
    return NextResponse.json(result, { status: result.success ? 200 : 503 });
  } catch (error) {
    console.error("shadow candle research auto cron pre-claim error", error);
    return NextResponse.json({ success: false, error: "RESEARCH_AUTO_UNAVAILABLE" }, { status: 503 });
  }
}
