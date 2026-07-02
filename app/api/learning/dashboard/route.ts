import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

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

function formatDate(value: unknown) {
  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function createAiComment({
  winRate,
  previousWinRate,
  diff,
  judgedTotal,
  win,
  lose,
  hold,
  unknown,
}: {
  winRate: number;
  previousWinRate: number;
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
    return `現在は学習データを蓄積中です。翌営業日のWIN/LOSE判定後にAI勝率が表示されます。`;
  }

  let trendComment = "";

  if (diff > 0) {
    trendComment = `前営業日より${diff}%改善しました。`;
  } else if (diff < 0) {
    trendComment = `前営業日より${Math.abs(diff)}%低下しました。`;
  } else {
    trendComment = "前営業日と同水準です。";
  }

  let levelComment = "";

  if (winRate >= 80) {
    levelComment =
      "🔥 AIは非常に高い精度を維持しています。現在の市場との相性も良好です。";
  } else if (winRate >= 60) {
    levelComment =
      "📈 AIは安定した学習を継続しています。精度は順調に向上しています。";
  } else if (winRate >= 40) {
    levelComment =
      "⚖️ AIは改善途中です。苦手パターンを分析しながら精度を高めています。";
  } else {
    levelComment =
      "⚠️ AIは現在改善フェーズです。学習データを蓄積しながら精度向上を目指します。";
  }

  return `
AI勝率は${winRate}%です。

${trendComment}

現在のWIN/LOSE判定件数は${judgedTotal}件です。

WIN：${win}件
LOSE：${lose}件
HOLD：${hold}件
判定待ち：${unknown}件

${levelComment}
`.trim();
}

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT *
      FROM daily_stock_results
      ORDER BY created_at ASC
    `);

    const total = rows.length;

    const win = rows.filter((row) => row.result === "WIN").length;
    const lose = rows.filter((row) => row.result === "LOSE").length;
    const hold = rows.filter((row) => row.result === "HOLD").length;
    const unknown = rows.filter((row) => row.result === "UNKNOWN").length;

    const judgedTotal = win + lose;

    const winRate =
      judgedTotal === 0 ? 0 : Math.round((win / judgedTotal) * 100);

    const stockMap = new Map<string, StockStats>();

    for (const row of rows) {
      const code = String(row.code || "");
      if (!code) continue;

      const name = String(row.name || code);

      const current =
        stockMap.get(code) || {
          code,
          name,
          total: 0,
          win: 0,
          lose: 0,
          hold: 0,
          unknown: 0,
          winRate: 0,
        };

      current.total += 1;

      if (row.result === "WIN") current.win += 1;
      if (row.result === "LOSE") current.lose += 1;
      if (row.result === "HOLD") current.hold += 1;
      if (row.result === "UNKNOWN") current.unknown += 1;

      const judged = current.win + current.lose;
      current.winRate =
        judged === 0 ? 0 : Math.round((current.win / judged) * 100);

      stockMap.set(code, current);
    }

    const stockStats = Array.from(stockMap.values()).filter(
      (stock) => stock.total >= 1
    );

    const bestStocks = [...stockStats]
      .filter((stock) => stock.win + stock.lose > 0)
      .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
      .slice(0, 5);

    const worstStocks = [...stockStats]
      .filter((stock) => stock.win + stock.lose > 0)
      .sort((a, b) => a.winRate - b.winRate || b.total - a.total)
      .slice(0, 5);

    const trendMap = new Map<string, TrendItem>();

    for (const row of rows) {
      const date = formatDate(row.created_at);
      if (!date) continue;

      const current =
        trendMap.get(date) || {
          date,
          total: 0,
          win: 0,
          lose: 0,
          hold: 0,
          winRate: 0,
        };

      current.total += 1;

      if (row.result === "WIN") current.win += 1;
      if (row.result === "LOSE") current.lose += 1;
      if (row.result === "HOLD") current.hold += 1;

      const judged = current.win + current.lose;
      current.winRate =
        judged === 0 ? 0 : Math.round((current.win / judged) * 100);

      trendMap.set(date, current);
    }

    const winRateTrend = Array.from(trendMap.values());

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
      previousWinRate,
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

    return NextResponse.json({
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
    });
  }
}