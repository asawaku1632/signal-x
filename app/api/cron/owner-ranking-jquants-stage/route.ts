import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { fetchDay } from "@/app/lib/jquantsNightRunner";
import { jquantsCode } from "@/app/lib/jquantsNightData.mjs";
import { isTseTradingDate } from "@/app/lib/technicalObservation/tseMarketCalendar";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type DailyRow = Record<string, unknown>;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Owner-only staging. The raw/adjusted price relationship must be reconciled
 * with each entry quote before outcome calculation can be enabled.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  const date = new URL(request.url).searchParams.get("date");
  if (!date || !DATE_RE.test(date) || !isTseTradingDate(date)) {
    return NextResponse.json({ success: false, error: "valid TSE trading date required" }, { status: 400 });
  }
  const now = new Date();
  const todayJst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  if (date >= todayJst) {
    return NextResponse.json({ success: false, error: "historical dates only; wait for provider publication" }, { status: 400 });
  }
  const key = process.env.JQUANTS_API_KEY;
  if (!key) return NextResponse.json({ success: false, error: "JQuants key unavailable" }, { status: 503 });
  try {
    const rows = await fetchDay(date, key, Date.now() + 145_000) as DailyRow[];
    const seen = new Set<string>();
    const valid: { code: string; raw: number; adjusted: number; ratio: number }[] = [];
    for (const row of rows) {
      const code = jquantsCode(row.Code);
      const raw = row.C, adjusted = row.AdjC;
      if (!code || row.Date !== date || typeof raw !== "number" ||
        typeof adjusted !== "number" || !Number.isFinite(raw) ||
        !Number.isFinite(adjusted) || raw <= 0 || adjusted <= 0 ||
        seen.has(code)) continue;
      seen.add(code);
      valid.push({ code, raw, adjusted, ratio: adjusted / raw });
    }
    if (valid.length < 800) {
      return NextResponse.json({ success: false, status: "insufficient_provider_coverage", count: valid.length }, { status: 503 });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of valid) {
        await client.query(`
          INSERT INTO owner_ranking_jquants_daily_staging
            (trade_date, code, raw_close, adjusted_close, adjustment_ratio, retrieved_at)
          VALUES ($1::date, $2, $3, $4, $5, now())
          ON CONFLICT (trade_date, code) DO NOTHING
        `, [date, item.code, item.raw, item.adjusted, item.ratio]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json({
      success: true, status: "staged_unverified", date, count: valid.length,
      note: "Not eligible for forward returns until publication time, corporate actions and entry-price adjustment are independently verified.",
    });
  } catch (error) {
    console.error("ranking JQuants staging failed", error);
    return NextResponse.json({ success: false, status: "provider_or_storage_error" }, { status: 503 });
  }
}
