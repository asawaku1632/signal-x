import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";

type RankingRow = {
  code: string;
  name: string;
  total: number;
  win: number;
  lose: number;
  hold: number;
  unknown: number;
  winRate: number;
};

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export async function GET() {
  try {
    const { rows } = await pool.query(`
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
        AND code <> ''
      GROUP BY code
    `);

    const ranking: RankingRow[] = rows
      .map((row) => {
        const win = toNumber(row.win);
        const lose = toNumber(row.lose);
        const judged = win + lose;

        return {
          code: String(row.code ?? ""),
          name: String(row.name ?? row.code ?? "名称不明"),
          total: toNumber(row.total),
          win,
          lose,
          hold: toNumber(row.hold),
          unknown: toNumber(row.unknown),
          winRate:
            judged > 0 ? Math.round((win / judged) * 100) : 0,
        };
      })
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.win !== a.win) return b.win - a.win;
        return b.total - a.total;
      });

    return NextResponse.json({
      success: true,
      count: ranking.length,
      ranking,
      updatedAt: new Date().toLocaleString("ja-JP", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  } catch (error) {
    console.error("result ranking error:", error);

    return NextResponse.json(
      {
        success: false,
        count: 0,
        ranking: [],
        error: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toLocaleString("ja-JP"),
      },
      { status: 500 }
    );
  }
}