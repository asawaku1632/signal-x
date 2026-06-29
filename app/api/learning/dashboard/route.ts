import { NextResponse } from "next/server";
import db from "@/app/lib/db";

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

    const judgedTotal = win + lose;

    const winRate =
      judgedTotal === 0 ? 0 : Math.round((win / judgedTotal) * 100);

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

      bestStocks: [],
      worstStocks: [],

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