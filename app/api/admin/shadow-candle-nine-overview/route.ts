import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import {
  SHADOW_CANDLE_DETECTOR_VERSION,
  studyShadowCandlePatterns,
} from "@/app/lib/research/shadowCandlestickNine";
import {
  combineArchivedShadowRuns,
  type ArchivedShadowRun,
} from "@/app/lib/research/shadowCandleArchiveStats";
import { evaluateShadowBuyCaution } from "@/app/lib/research/shadowCandleBuyCaution";
import { summarizeShadowNine } from "@/app/lib/research/shadowCandleNineOverview";
import { dateJst, fetchCohort } from "@/app/lib/research/shadowCandleYahoo";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 25;

const headers = { "Cache-Control": "private, no-store, max-age=0" };

/**
 * Owner-only on-demand read, NOT a page-load fetch, prefetch, cron, or a new
 * trading rule. Called only when the owner expands their stock's summary.
 * Exactly one Yahoo 6-month daily OHLC request per explicit interaction.
 */
export async function POST(request: NextRequest) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) {
    return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404, headers });
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, error: "ORIGIN_NOT_ALLOWED" }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ success: false, error: "JSON_REQUIRED" }, { status: 415, headers });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(contentLength) || contentLength > 512) {
    return NextResponse.json({ success: false, error: "INVALID_INPUT" }, { status: 400, headers });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "INVALID_JSON" }, { status: 400, headers });
  }
  const input = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>).code : null;
  const code = typeof input === "string" ? input.trim().toUpperCase() : "";
  if (!/^[0-9A-Z]{4,5}$/.test(code)) {
    return NextResponse.json({ success: false, error: "INVALID_CODE" }, { status: 400, headers });
  }

  try {
    const loaded = await fetchCohort([code]);
    const stock = loaded[0];
    if (!stock || stock.error || stock.candles.length < 20) {
      return NextResponse.json({ success: false, error: "PRICE_DATA_UNAVAILABLE" }, { status: 503, headers });
    }
    const candles = stock.candles;
    const studies = studyShadowCandlePatterns(candles);

    // Archive aggregation must not prevent read-only pattern detection.
    let archiveRows: ReturnType<typeof combineArchivedShadowRuns>["rows"] | null = null;
    try {
      const archive = await pool.query<ArchivedShadowRun>(`
        SELECT id::text, detector_version, events
        FROM public.shadow_candle_research_runs
        WHERE detector_version = $1 ORDER BY created_at DESC LIMIT 250
      `, [SHADOW_CANDLE_DETECTOR_VERSION]);
      archiveRows = combineArchivedShadowRuns(archive.rows).rows;
    } catch (error) {
      console.error("owner stock shadow overview archive unavailable", error);
    }
    const latestTime = candles[candles.length - 1].time;
    const caution = evaluateShadowBuyCaution({
      hits: studies.flatMap(s => s.hits),
      latestCompletedBarTime: latestTime,
      todayJst: dateJst(Date.now() / 1000),
      archiveRows,
    });
    const summary = summarizeShadowNine(studies, candles, caution);
    return NextResponse.json({
      success: true,
      code,
      latestDate: dateJst(latestTime),
      candleCount: candles.length,
      archiveAvailable: archiveRows !== null,
      summary,
    }, { headers });
  } catch (error) {
    console.error("owner stock shadow overview failure", error);
    return NextResponse.json({ success: false, error: "RESEARCH_UNAVAILABLE" }, { status: 503, headers });
  }
}
