import "server-only";
import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getTseCashSessionStatus, isTseTradingDate, TSE_MARKET_CALENDAR_COVERAGE } from "@/app/lib/technicalObservation/tseMarketCalendar";
import { buildDaily100Partitions } from "@/app/lib/research/bollingerDaily100Plan";
import { BB_FORWARD_FROZEN_CODES } from "@/app/lib/research/bollingerForwardUniverse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
const headers = { "Cache-Control": "private, no-store" };

/** Read-only owner diagnostic. No POST, DB writes, vendor requests or Cron. */
export async function GET() {
  if (!(await getLearningOwnerSession()).isOwner) {
    return NextResponse.json({ success: false, error: "OWNER_ONLY" }, { status: 403, headers });
  }
  // Never expose this diagnostic in production, including an accidental branch deployment.
  if (process.env.VERCEL_ENV === "production" || process.env.BB_DAILY100_DEV_DIAGNOSTIC !== "true") {
    return NextResponse.json({ success: false, error: "DEV_ONLY_DISABLED" }, { status: 404, headers });
  }
  const session = getTseCashSessionStatus(new Date());
  const calendarCovered = session.date >= TSE_MARKET_CALENDAR_COVERAGE.startDate &&
    session.date <= TSE_MARKET_CALENDAR_COVERAGE.endDate;
  const tradingDay = calendarCovered && isTseTradingDate(session.date);
  const partitions = buildDaily100Partitions(BB_FORWARD_FROZEN_CODES);
  return NextResponse.json({
    success: true,
    mode: "READ_ONLY_NO_VENDOR_NO_DB_WRITE",
    marketDate: session.date,
    calendarCovered,
    tradingDay,
    partitions: partitions.map(p => ({ partitionId: p.partitionId, count: p.codes.length })),
    totalCodes: partitions.reduce((n, p) => n + p.codes.length, 0),
  }, { headers });
}
