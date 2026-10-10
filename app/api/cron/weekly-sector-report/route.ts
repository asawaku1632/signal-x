import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { rank, recognizedCodes, weeksForNow, type ResultRow } from "@/app/lib/weeklySectorReport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Only Vercel Cron (or an administrator with CRON_SECRET) can issue a snapshot.
// Prediction rows are INSERT ONLY; replays cannot rewrite history.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", weekday: "short",
  }).format(new Date());
  if (weekday !== "Sat" && weekday !== "Sun") {
    return NextResponse.json({ success: false, error: "Weekend issue window only" }, { status: 409 });
  }
  const week = weeksForNow();
  try {
    const existing = await pool.query(
      "SELECT target_week_start FROM weekly_sector_forecasts WHERE target_week_start = $1::date LIMIT 1",
      [week.targetStart],
    );
    if (existing.rowCount) {
      return NextResponse.json({ success: true, status: "already_issued", targetWeek: week.targetStart });
    }
    const { rows } = await pool.query<ResultRow>(`
      SELECT date, code, name, result, change_percent
      FROM daily_stock_results
      WHERE date >= $1 AND date < $2
        AND code = ANY($3::text[])
        AND result IN ('WIN', 'LOSE', 'HOLD')
        AND change_percent IS NOT NULL
      ORDER BY date, code
    `, [week.previousStart, week.targetStart, recognizedCodes]);
    const sourceRows = rows.filter((row) => row.date >= week.sourceStart);
    const dates = [...new Set(sourceRows.map((row) => row.date))].sort();
    const asOf = dates.at(-1) ?? null;
    if (dates.length < 2 || !asOf) {
      return NextResponse.json({ success: false, error: "Insufficient judged trading days", targetWeek: week.targetStart }, { status: 503 });
    }
    const { ranked, eligible } = rank(rows, week.sourceStart);
    if (ranked.length === 0) {
      return NextResponse.json({ success: false, error: "No eligible sectors", targetWeek: week.targetStart }, { status: 503 });
    }
    const saved = await pool.query(`
      INSERT INTO weekly_sector_forecasts (
        target_week_start, target_week_end,
        source_week_start, source_week_end, as_of_date,
        items, eligible_sector_count, classifier_version, model_version
      ) VALUES (
        $1::date, $2::date, $3::date, $4::date, $5::date,
        $6::jsonb, $7::integer, 'representative-v1', 'weekly-sector-v1'
      ) ON CONFLICT (target_week_start) DO NOTHING
      RETURNING target_week_start
    `, [
      week.targetStart, week.targetEnd, week.sourceStart, week.sourceEnd,
      asOf, JSON.stringify(ranked), eligible,
    ]);
    return NextResponse.json({
      success: true,
      status: saved.rowCount ? "issued" : "already_issued",
      targetWeek: week.targetStart,
      asOf,
      sectorCount: ranked.length,
    });
  } catch (error) {
    console.error("weekly sector issue failed:", error);
    return NextResponse.json({ success: false, error: "Issue failed" }, { status: 500 });
  }
}
