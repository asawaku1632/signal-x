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

function createAiComment({
  winRate,
  diff,
  judgedTotal,
  win,
  lose,
  hold,
  unknown,
}: {
  winRate: number;
  diff: number;
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

  const trendComment =
    diff > 0
      ? `前営業日より${diff}%改善しました。`
      : diff < 0
        ? `前営業日より${Math.abs(diff)}%低下しました。`
        : "前営業日と同水準です。";

  return `
現在のAI勝率は${winRate}%です。${trendComment}

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
    const [summaryResult, stockResult, trendResult] = await Promise.all([
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
          TO_CHAR(created_at::date, 'YYYY-MM-DD') AS date,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
          COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
          COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold
        FROM daily_stock_results
        GROUP BY created_at::date
        ORDER BY created_at::date ASC
      `),
    ]);

    const summary = summaryResult.rows[0] ?? {};
    const total = toNumber(summary.total);
    const win = toNumber(summary.win);
    const lose = toNumber(summary.lose);
    const hold = toNumber(summary.hold);
    const unknown = toNumber(summary.unknown);

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
      const trendWin = toNumber(row.win);
      const trendLose = toNumber(row.lose);
      const judged = trendWin + trendLose;

      return {
        date: String(row.date ?? ""),
        total: toNumber(row.total),
        win: trendWin,
        lose: trendLose,
        hold: toNumber(row.hold),
        winRate:
          judged === 0 ? 0 : Math.round((trendWin / judged) * 100),
      };
    });

    const judgedTrend = winRateTrend.filter(
      (item) => item.win + item.lose > 0
    );

    const previousWinRate =
      judgedTrend.length >= 2
        ? judgedTrend[judgedTrend.length - 2].winRate
        : winRate;

    const diff = winRate - previousWinRate;

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
      diff,
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
      dateCount: winRateTrend.length,
      bestStocks,
      worstStocks,
      winRateTrend,
      growthTrend,
      resultPie,
      comment,
      updatedAt: new Date().toLocaleString("ja-JP", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
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
      { status: 500 }
    );
  }
}