import { NextResponse } from "next/server";
import db from "@/app/lib/db";

type StockStats = {
  code: string;
  name: string;
  total: number;
  win: number;
  lose: number;
  winRate: number;
};

export async function GET() {
  try {
    const rows = db
      .prepare(
        `
        SELECT *
        FROM learning_logs
        `
      )
      .all() as any[];

    const total = rows.length;

    const win = rows.filter((row) => row.result === "win").length;
    const lose = rows.filter((row) => row.result === "lose").length;
    const hold = rows.filter((row) => row.result === "hold").length;
    const pending = rows.filter((row) => row.result === "pending").length;

    const judgedRows = rows.filter(
      (row) => row.result === "win" || row.result === "lose"
    );

    const judgedTotal = win + lose;

    const winRate =
      judgedTotal === 0 ? 0 : Math.round((win / judgedTotal) * 100);

    const stockMap = new Map<string, StockStats>();

    for (const row of judgedRows) {
      const code = String(row.code || row.stockCode || "");
      if (!code) continue;

      const name = String(row.name || row.stockName || code);

      const current =
        stockMap.get(code) || {
          code,
          name,
          total: 0,
          win: 0,
          lose: 0,
          winRate: 0,
        };

      current.total += 1;

      if (row.result === "win") current.win += 1;
      if (row.result === "lose") current.lose += 1;

      current.winRate = Math.round((current.win / current.total) * 100);

      stockMap.set(code, current);
    }

    const stockStats = Array.from(stockMap.values()).filter(
      (stock) => stock.total >= 2
    );

    const bestStocks = [...stockStats]
      .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
      .slice(0, 3);

    const worstStocks = [...stockStats]
      .sort((a, b) => a.winRate - b.winRate || b.total - a.total)
      .slice(0, 3);

    const dateSet = new Set(
      rows
        .map((row) => String(row.createdAt || row.checkedAt || "").slice(0, 10))
        .filter(Boolean)
    );

    return NextResponse.json({
      success: true,

      total,
      win,
      lose,
      hold,
      pending,
      winRate,

      growth: total,
      dateCount: dateSet.size,

      bestStocks,
      worstStocks,

      winRateTrend: [],

      comment:
        judgedTotal === 0
          ? "AIは現在データ蓄積中です。検証数が増えるほど、勝率の精度が上がります。"
          : `現在${judgedTotal}件の判定済みデータからAI勝率を算出しています。`,

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
        growth: 0,
        dateCount: 0,
        bestStocks: [],
        worstStocks: [],
        winRateTrend: [],
        comment: "AI学習データの取得に失敗しました。",
        updatedAt: new Date().toLocaleString("ja-JP"),
      },
      { status: 500 }
    );
  }
}