import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { getAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Owner-only, bounded read-only research export. Does not retrieve J-Quants data,
 * change historical labels, or assert Yahoo snapshot prices are official closes.
 */
export async function GET(request: Request) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "Administrator access required" }, { status: 403 });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const validDate = (v: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v + "T00:00:00Z")) &&
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v);
  if (!validDate(from) || !validDate(to) || from! > to!) {
    return NextResponse.json({ success: false, error: "Valid from/to ISO dates required" }, { status: 400 });
  }
  const requestedLimit = Number(url.searchParams.get("limit") ?? "100");
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200) {
    return NextResponse.json({ success: false, error: "limit must be 1..200" }, { status: 400 });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, date::text AS date, code, score, price, result, created_at
       FROM daily_stock_results
       WHERE date >= $1::date AND date <= $2::date
       ORDER BY date ASC, code ASC, id ASC
       LIMIT $3`,
      [from, to, requestedLimit],
    );
    return NextResponse.json({
      success: true,
      kind: "DAILY_FORWARD_SOURCE_SNAPSHOT_READ_ONLY_V1",
      source: "daily_stock_results",
      upstreamPriceBasis: "UNVERIFIED_YAHOO_SCAN_SNAPSHOT",
      rows: rows.map((row) => ({
        id: row.id, date: String(row.date).slice(0, 10), code: row.code,
        score: row.score === null ? null : Number(row.score),
        price: row.price === null ? null : Number(row.price),
        originalResult: row.result, createdAt: row.created_at,
        priceBasisVerified: false,
      })),
      cappedAt: requestedLimit,
      note: "Historical price source and official close comparability are not independently certified.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[daily-forward-source] read failed", error);
    return NextResponse.json({ success: false, error: "研究用データの取得に失敗しました" }, { status: 500 });
  }
}
