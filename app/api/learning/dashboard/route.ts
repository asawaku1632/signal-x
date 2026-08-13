import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { calculateConfirmedWinRateDiff, calculateWinRate } from "@/app/lib/winRateDisplay";

export const dynamic = "force-dynamic";

type StockStats = {
  code: string;
  name: string;
  total: number;
  win: number;
  lose: number;
  hold: number;
  unknown: number;
  winRate: number;
};

type TrendItem = {
  date: string;
  total: number;
  win: number;
  lose: number;
  hold: number;
  pending: number;
  winRate: number | null;
  status: "confirmed" | "processing" | "waiting_for_price";
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMonthDay(date: string) {
  const match = date.match(/^(?:\d{4}-)?(\d{2})-(\d{2})/);
  return match ? `${match[1]}/${match[2]}` : date;
}

function createAiComment({
  winRate,
  latestPreviousBusinessDate,
  processingDate,
  latestDaily,
  previousDaily,
  judgedTotal,
  win,
  lose,
  hold,
  unknown,
}: {
  winRate: number | null;
  latestPreviousBusinessDate?: string;
  processingDate?: string;
  latestDaily?: TrendItem;
  previousDaily?: TrendItem;
  judgedTotal: number;
  win: number;
  lose: number;
  hold: number;
  unknown: number;
}) {
  if (judgedTotal === 0 && hold > 0) {
    return `現在${hold}件のHOLD判定があります。まだ大きな値動きが出ていないため、AIは慎重に学習データを蓄積中です。`;
  }

  if (judgedTotal === 0) {
    return "現在は学習データを蓄積中です。翌営業日のWIN/LOSE判定後にAI勝率が表示されます。";
  }

  const confirmedDailyComment = latestDaily
    ? previousDaily
      ? (() => {
          const diff =
            (latestDaily.winRate ?? 0) - (previousDaily.winRate ?? 0);
          const comparison =
            diff > 0
              ? `${diff}ポイント上昇しています。`
              : diff < 0
                ? `${Math.abs(diff)}ポイント低下しています。`
                : "同水準です。";

          return `前営業日（${formatMonthDay(latestDaily.date)}）の日次勝率は${latestDaily.winRate}%でした。

前回の日次勝率（${formatMonthDay(previousDaily.date)}：${previousDaily.winRate}%）との差は
${comparison}`;
        })()
      : `前営業日（${formatMonthDay(latestDaily.date)}）の日次勝率は${latestDaily.winRate}%でした。`
    : "日次勝率はまだ算出されていません。";

  const dailyComment = processingDate
    ? processingDate === latestPreviousBusinessDate
      ? `最新の前営業日（${formatMonthDay(processingDate)}）は現在判定処理中です。\n\n${confirmedDailyComment}`
      : `未判定バックログ（${formatMonthDay(processingDate)}）は現在判定処理中です。\n\n${confirmedDailyComment}`
    : confirmedDailyComment;

  return `
現在のAI累計勝率は${winRate}%です。

${dailyComment}

※日次勝率は市場全体の地合いの影響を受けるため、
全面高・全面安など相場環境によって大きく変動します。

これまで${judgedTotal}件の判定結果を学習し、
${win}件の成功パターン（WIN）と${lose}件の失敗パターン（LOSE）を蓄積しました。

📚 継続観察中：${hold}件
⏳ 次回判定予定：${unknown}件

学習データが増えるほどAI POWERの精度はさらに向上していきます。

🚀 SIGNALXは、毎営業日学習を繰り返しながら成長する自己学習型AIです。
`.trim();
}

export async function GET() {
  try {
    const [summaryResult, stockResult, trendResult, metadataResult] =
      await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
          COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
          COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold,
          COUNT(*) FILTER (WHERE result = 'UNKNOWN')::int AS unknown
        FROM daily_stock_results
      `),
      pool.query(`
        SELECT
          code,
          COALESCE(MAX(name), code) AS name,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
          COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
          COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold,
          COUNT(*) FILTER (WHERE result = 'UNKNOWN')::int AS unknown
        FROM daily_stock_results
        WHERE code IS NOT NULL
        GROUP BY code
      `),
      pool.query(`
          SELECT
            date,
            total,
            win,
            lose,
            hold,
            pending
        FROM (
          SELECT
            date,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
            COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
            COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold,
            COUNT(*) FILTER (WHERE result = 'UNKNOWN')::int AS pending
          FROM daily_stock_results
          WHERE date IS NOT NULL
          GROUP BY date
          ORDER BY date DESC
          LIMIT 5
        ) AS latest_days
        ORDER BY date ASC
      `),
      pool.query(`
        SELECT
          COUNT(DISTINCT date) FILTER (
            WHERE date IS NOT NULL
              AND result IN ('WIN', 'LOSE', 'HOLD')
          )::int AS date_count,
          MAX(date) FILTER (
            WHERE date IS NOT NULL
              AND date::date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date
          ) AS latest_previous_business_date,
          MAX(date) FILTER (WHERE date IS NOT NULL) AS latest_saved_date,
          (
            SELECT MAX(confirmed.date)
            FROM (
              SELECT date
              FROM daily_stock_results
              WHERE date IS NOT NULL
              GROUP BY date
              HAVING COUNT(*) FILTER (WHERE result = 'UNKNOWN') = 0
            ) AS confirmed
          ) AS latest_confirmed_date,
          MAX(date) FILTER (
            WHERE date IS NOT NULL
              AND result = 'UNKNOWN'
              AND date::date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date
          ) AS processing_date,
          MAX(GREATEST(created_at, COALESCE(checked_at, created_at))) AS updated_at
        FROM daily_stock_results
      `),
    ]);

    const summary = summaryResult.rows[0] ?? {};
    const total = toNumber(summary.total);
    const win = toNumber(summary.win);
    const lose = toNumber(summary.lose);
    const hold = toNumber(summary.hold);
    const unknown = toNumber(summary.unknown);
    const metadata = metadataResult.rows[0] ?? {};
    const dateCount = toNumber(metadata.date_count);
    const latestPreviousBusinessDate = metadata.latest_previous_business_date
      ? String(metadata.latest_previous_business_date).slice(0, 10)
      : undefined;
    const processingDate = metadata.processing_date
      ? String(metadata.processing_date).slice(0, 10)
      : undefined;
    const updatedAt = metadata.updated_at ?? null;
    const latestSavedDate = metadata.latest_saved_date
      ? String(metadata.latest_saved_date).slice(0, 10)
      : undefined;
    const latestConfirmedDate = metadata.latest_confirmed_date
      ? String(metadata.latest_confirmed_date).slice(0, 10)
      : undefined;

    const judgedTotal = win + lose;
    const winRate = calculateWinRate(win, lose);

    const stockStats: StockStats[] = stockResult.rows.map((row) => {
      const stockWin = toNumber(row.win);
      const stockLose = toNumber(row.lose);
      const judged = stockWin + stockLose;

      return {
        code: String(row.code ?? ""),
        name: String(row.name ?? row.code ?? ""),
        total: toNumber(row.total),
        win: stockWin,
        lose: stockLose,
        hold: toNumber(row.hold),
        unknown: toNumber(row.unknown),
        winRate:
          judged === 0 ? 0 : Math.round((stockWin / judged) * 100),
      };
    });

    const bestStocks = [...stockStats]
      .filter((stock) => stock.win + stock.lose > 0)
      .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
      .slice(0, 5);

    const worstStocks = [...stockStats]
      .filter((stock) => stock.win + stock.lose > 0)
      .sort((a, b) => a.winRate - b.winRate || b.total - a.total)
      .slice(0, 5);

    const winRateTrend: TrendItem[] = trendResult.rows.map((row) => {
      const dayWin = toNumber(row.win);
      const dayLose = toNumber(row.lose);
      const dayHold = toNumber(row.hold);
      const pending = toNumber(row.pending);
      const status =
        pending === 0
          ? "confirmed"
          : dayWin + dayLose + dayHold === 0
            ? "waiting_for_price"
            : "processing";

      return {
        date: String(row.date ?? ""),
        total: toNumber(row.total),
        win: dayWin,
        lose: dayLose,
        hold: dayHold,
        pending,
        winRate: calculateWinRate(dayWin, dayLose),
        status,
      };
    });

    const confirmedTrend = winRateTrend.filter(
      (item) => item.pending === 0 && item.winRate !== null,
    );
    const previousWinRate = confirmedTrend.at(-2)?.winRate ?? null;
    const diff = calculateConfirmedWinRateDiff(
      winRateTrend.map((item) => ({
        win: item.win,
        lose: item.lose,
        unknown: item.pending,
      })),
    );

    const growthTrend = winRateTrend.map((item) => {
      return {
        date: item.date,
        total: item.total,
      };
    });

    const resultPie = [
      { name: "WIN", value: win },
      { name: "LOSE", value: lose },
      { name: "HOLD", value: hold },
      { name: "判定待ち", value: unknown },
    ];

    const comment = createAiComment({
      winRate,
      latestPreviousBusinessDate,
      processingDate,
      latestDaily: confirmedTrend.at(-1),
      previousDaily: confirmedTrend.at(-2),
      judgedTotal,
      win,
      lose,
      hold,
      unknown,
    });

    return NextResponse.json({
      success: true,
      total,
      win,
      lose,
      hold,
      pending: unknown,
      winRate,
      previousWinRate,
      diff,
      growth: total,
      dateCount,
      bestStocks,
      worstStocks,
      winRateTrend,
      growthTrend,
      resultPie,
      comment,
      latestPreviousBusinessDate: latestPreviousBusinessDate ?? null,
      latestConfirmedDate: latestConfirmedDate ?? null,
      latestSavedDate: latestSavedDate ?? null,
      processingDate: processingDate ?? null,
      updatedAt,
    });
  } catch (error) {
    console.error("learning dashboard error:", error);

    return NextResponse.json(
      {
        success: false,
        total: 0,
        win: 0,
        lose: 0,
        hold: 0,
        pending: 0,
        winRate: null,
        previousWinRate: null,
        diff: null,
        growth: 0,
        dateCount: 0,
        bestStocks: [],
        worstStocks: [],
        winRateTrend: [],
        growthTrend: [],
        resultPie: [],
        comment: "AI学習データの取得に失敗しました。",
        latestPreviousBusinessDate: null,
        latestConfirmedDate: null,
        processingDate: null,
        updatedAt: new Date().toLocaleString("ja-JP"),
      },
      { status: 500 },
    );
  }
}
