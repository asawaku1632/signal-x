import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { getLatestScanSnapshotSlice } from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// UTC cron slots correspond to 08:50, 09:15, 11:30 JST.
// A missed slot is NOT reconstructed from a later snapshot.
const SLOTS = ["08:50", "09:15", "11:30"] as const;
const MAX_DELAY_MINUTES = 4;
function jstParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`,
    minute: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: get("weekday") };
}
function parseTime(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  const now = new Date();
  const jst = jstParts(now);
  if (jst.weekday === "Sat" || jst.weekday === "Sun") {
    return NextResponse.json({ success: true, status: "weekend_skip" });
  }
  const slot = SLOTS.find((s) => {
    const [hour, minute] = s.split(":").map(Number);
    const delay = jst.minute - (hour * 60 + minute);
    return delay >= 0 && delay <= MAX_DELAY_MINUTES;
  });
  if (!slot) return NextResponse.json({ success: true, status: "outside_slot" });
  const snapshot = await getLatestScanSnapshotSlice(100);
  if (!snapshot || !Array.isArray(snapshot.payload?.stocks) || snapshot.payload.stocks.length < 100) {
    return NextResponse.json({ success: false, status: "missing_coverage" }, { status: 503 });
  }
  const snapshotMs = parseTime(snapshot.updatedAt);
  // Strict pre-observation freeze; the scan may be stale, but never from the future.
  if (snapshotMs === null || snapshotMs > now.getTime() ||
      now.getTime() - snapshotMs > 15 * 60_000) {
    return NextResponse.json({ success: false, status: "stale_or_future_snapshot" }, { status: 503 });
  }
  const stocks = snapshot.payload.stocks.slice(0, 100).map((raw: Record<string, unknown>, index: number) => {
    const quoteAt = typeof raw.latestBarTimestamp === "string" ? raw.latestBarTimestamp : null;
    const quoteMs = parseTime(quoteAt);
    const validQuote = quoteMs !== null && quoteMs <= snapshotMs;
    return {
      rank: index + 1,
      code: String(raw.code ?? raw.stockCode ?? ""),
      score: typeof raw.score === "number" ? raw.score : null,
      price: typeof raw.price === "number" ? raw.price : null,
      quoteAt,
      quoteTimeVerified: validQuote,
      // No unverified intraday quote is admitted to forward-return calculations.
      eligibleForForward: slot !== "08:50" && validQuote &&
        quoteMs !== null && quoteMs >= now.getTime() - 15 * 60_000,
    };
  });
  // Never pretend a pre-open capture is based on intraday quotes.
  const eligibleCount = stocks.filter((s) => s.eligibleForForward).length;
  try {
    const result = await pool.query(
      `INSERT INTO owner_ranking_forward_captures
       (trade_date_jst, slot_jst, captured_at, source_snapshot_at, records, eligible_count, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (trade_date_jst, slot_jst) DO NOTHING RETURNING id`,
      [jst.day, slot, now.toISOString(), snapshot.updatedAt,
        JSON.stringify(stocks), eligibleCount,
        eligibleCount === 100 ? "quote_time_verified" : "research_only_unverified"],
    );
    return NextResponse.json({
      success: true, status: result.rowCount ? "frozen" : "already_frozen",
      slot, date: jst.day, count: stocks.length, eligibleCount,
      note: "Research only; not a trading signal. Exchange holidays require independent calendar verification.",
    });
  } catch (error) {
    console.error("ranking capture write failed", error);
    return NextResponse.json({ success: false, status: "storage_error" }, { status: 500 });
  }
}
