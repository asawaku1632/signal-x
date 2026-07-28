import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

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
  winRate: number;
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
  latestDaily,
  previousDaily,
  judgedTotal,
  win,
  lose,
  hold,
  unknown,
}: {
  winRate: number;
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

  const dailyComment = latestDaily
    ? previousDaily
      ? (() => {
          const diff = latestDaily.winRate - previousDaily.winRate;
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
          hold
        FROM (
          SELECT
            date,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
            COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
            COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold
          FROM daily_stock_results
          WHERE date IS NOT NULL
            AND result IN ('WIN', 'LOSE')
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
    const updatedAt = metadata.updated_at ?? null;

    const judgedTotal = win + lose;
    const winRate =
      judgedTotal === 0 ? 0 : Math.round((win / judgedTotal) * 100);

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
      const judged = dayWin + dayLose;

      return {
        date: String(row.date ?? ""),
        total: toNumber(row.total),
        win: dayWin,
        lose: dayLose,
        hold: toNumber(row.hold),
        winRate:
          judged === 0 ? 0 : Math.round((dayWin / judged) * 100),
      };
    });

    const judgedTrend = winRateTrend.filter(
      (item) => item.win + item.lose > 0,
    );

    const latestDailyWinRate =
      judgedTrend.length > 0
        ? judgedTrend[judgedTrend.length - 1].winRate
        : winRate;

    const previousWinRate =
      judgedTrend.length >= 2
        ? judgedTrend[judgedTrend.length - 2].winRate
        : latestDailyWinRate;

    const diff = latestDailyWinRate - previousWinRate;

    let cumulativeTotal = 0;
    const growthTrend = winRateTrend.map((item) => {
      cumulativeTotal += item.total;
      return {
        date: item.date,
        total: cumulativeTotal,
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
      latestDaily: judgedTrend.at(-1),
      previousDaily: judgedTrend.at(-2),
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
        winRate: 0,
        previousWinRate: 0,
        diff: 0,
        growth: 0,
        dateCount: 0,
        bestStocks: [],
        worstStocks: [],
        winRateTrend: [],
        growthTrend: [],
        resultPie: [],
        comment: "AI学習データの取得に失敗しました。",
        updatedAt: new Date().toLocaleString("ja-JP"),
      },
      { status: 500 },
    );
  }
}
