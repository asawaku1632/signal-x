import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import pool from "@/app/lib/postgres";
import {
  collectYahooDailyReferences,
  compareDailyLearningPrice,
  isValidJapanStockCode,
  isValidPriceAuditDate,
} from "@/app/lib/learning/dailyPriceAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SavedPriceRow = {
  date: string; code: string; name: string; price: number | string; created_at: Date | string;
};

/**
 * Admin-only, on-demand, read-only research endpoint.
 * Intentionally does not repair historical prices, trigger cron, re-score, or send notifications.
 */
export async function GET(request: Request) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: "管理者権限が必要です" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const code = params.get("code")?.trim() ?? "";
  const date = params.get("date")?.trim() ?? "";
  if (!isValidJapanStockCode(code) || !isValidPriceAuditDate(date)) {
    return NextResponse.json({ success: false, error: "銘柄コード4桁と日付（YYYY-MM-DD）を指定してください" }, { status: 400 });
  }

  try {
    const record = await pool.query<SavedPriceRow>(
      "SELECT date, code, name, price, created_at FROM public.daily_stock_results WHERE code = $1 AND date = $2 LIMIT 1",
      [code, date],
    );
    const row = record.rows[0];
    if (!row) {
      return NextResponse.json({ success: false, error: "指定日の学習保存記録がありません" }, { status: 404 });
    }
    const savedPrice = Number(row.price);
    if (!Number.isFinite(savedPrice) || savedPrice <= 0) {
      return NextResponse.json({ success: false, error: "学習保存株価が無効です" }, { status: 422 });
    }
    const saved = {
      code: row.code, name: row.name, date: row.date, price: savedPrice,
      savedAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      source: "DAILY_STOCK_RESULTS_FROM_SCAN",
    };
    const checkedAt = new Date();
    const nowJst = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(checkedAt);
    // Same-day Yahoo 1D bars can still be partial. Do not incorrectly call them closing prices.
    if (date >= nowJst) {
      return NextResponse.json({
        success: true, status: "PENDING", saved, reference: null,
        checkedAt: checkedAt.toISOString(),
        note: "当日の日足は未確定の可能性があるため、翌日以降に照合してください。学習データは変更していません。",
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const upstream = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(code + ".T") + "?range=2y&interval=1d",
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(9_000) },
    );
    if (!upstream.ok) throw new Error("YAHOO_CHART_UNAVAILABLE");
    const data = await upstream.json();
    const bars = collectYahooDailyReferences(data?.chart?.result?.[0]);
    const matching = bars.filter((bar) => bar.date === date);
    if (matching.length !== 1) {
      return NextResponse.json({
        success: true, status: "UNVERIFIED", saved, reference: null,
        checkedAt: checkedAt.toISOString(),
        note: "指定日の比較可能なYahoo日足が取得できないため、未確認です。学習データは変更していません。",
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const reference = {
      date, price: matching[0].close, barTime: new Date(matching[0].barTime * 1000).toISOString(),
      source: "YAHOO_CHART_1D",
    };
    const comparison = compareDailyLearningPrice(savedPrice, matching[0]);
    return NextResponse.json({
      success: true, ...comparison, saved, reference, checkedAt: checkedAt.toISOString(),
      note: "Yahoo日足を参考値として事後照合。速報・更新・株式分割による差の可能性があります。保存価格もAI判定も自動修正しません。",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[daily-price-audit] read-only price verification unavailable", error);
    return NextResponse.json({
      success: false, error: "照合先のデータを取得できませんでした。後で再試行してください。",
    }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
