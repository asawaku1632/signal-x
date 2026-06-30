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

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT *
      FROM daily_stock_results
      ORDER BY created_at DESC
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
      .slice(0, 3);

    const worstStocks = [...stockStats]
      .filter((stock) => stock.win + stock.lose > 0)
      .sort((a, b) => a.winRate - b.winRate || b.total - a.total)
      .slice(0, 3);

    const dateSet = new Set(
      rows
        .map((row) => String(row.created_at || "").slice(0, 10))
        .filter(Boolean)
    );

    return NextResponse.json({
      success: true,

      total,
      win,
      lose,
      hold,
      pending: unknown,
      winRate,

      growth: total,
      dateCount: dateSet.size,

      bestStocks,
      worstStocks,

      winRateTrend: [],

      comment:
  judgedTotal === 0 && hold > 0
    ? `現在${hold}件のHOLD判定があります。大きな値動きが出た銘柄からAI勝率に反映されます。`
    : judgedTotal === 0
    ? `現在${total}件の学習データを蓄積中です。翌営業日の判定後にAI勝率が表示されます。`
    : `現在${judgedTotal}件のWIN/LOSE判定済みデータからAI勝率を算出しています。`,

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
      growth: 0,
      dateCount: 0,
      bestStocks: [],
      worstStocks: [],
      winRateTrend: [],
      comment: "AI学習データの取得に失敗しました。",
      updatedAt: new Date().toLocaleString("ja-JP"),
    });
  }
}