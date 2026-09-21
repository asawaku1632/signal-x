import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";

function toNumber(value: unknown) {
  const valueNumber = Number(value ?? 0);
  return Number.isFinite(valueNumber) ? valueNumber : 0;
}

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        CASE
          WHEN score >= 95 THEN '大本命'
          WHEN score >= 85 THEN '買い候補'
          WHEN score >= 75 THEN '押し目待ち'
          WHEN score >= 65 THEN '様子見'
          ELSE '見送り'
        END AS reason,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
        COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
        COALESCE(AVG(change_percent), 0) AS avg_profit_rate,
        COALESCE(MAX(change_percent), 0) AS max_profit_rate,
        COALESCE(MIN(change_percent), 0) AS min_profit_rate
      FROM daily_stock_results
      WHERE result IN ('WIN', 'LOSE')
        AND change_percent IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `);

    const data = rows.map((row) => {
      const win = toNumber(row.win);
      const lose = toNumber(row.lose);
      const total = win + lose;
      return {
        reason: String(row.reason ?? "不明"),
        total,
        win,
        lose,
        winRate: total > 0 ? Math.round((win / total) * 1000) / 10 : 0,
        avgProfitRate: Math.round(toNumber(row.avg_profit_rate) * 100) / 100,
        maxProfitRate: Math.round(toNumber(row.max_profit_rate) * 100) / 100,
        minProfitRate: Math.round(toNumber(row.min_profit_rate) * 100) / 100,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      stats: data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("history stats error:", error);
    return NextResponse.json(
      {
        success: false,
        data: [],
        stats: [],
        error: "バックテスト実績の取得に失敗しました",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
