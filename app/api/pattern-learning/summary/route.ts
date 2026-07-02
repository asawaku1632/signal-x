import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

type SummaryRow = {
  pattern: string;
  total: number;
  win: number;
  lose: number;
  unknown: number;
  winRate: number;
};

async function getSummary(column: string): Promise<SummaryRow[]> {
  const { rows } = await pool.query(`
    SELECT
      ${column} AS pattern,
      COUNT(*)::int AS total,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END)::int AS win,
      SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END)::int AS lose,
      SUM(CASE WHEN result = 'UNKNOWN' THEN 1 ELSE 0 END)::int AS unknown
    FROM pattern_learning_logs
    WHERE ${column} IS NOT NULL
    GROUP BY ${column}
    ORDER BY total DESC
  `);

  return rows.map((row) => {
    const win = Number(row.win || 0);
    const lose = Number(row.lose || 0);
    const judged = win + lose;

    return {
      pattern: String(row.pattern),
      total: Number(row.total || 0),
      win,
      lose,
      unknown: Number(row.unknown || 0),
      winRate: judged === 0 ? 0 : Math.round((win / judged) * 100),
    };
  });
}

export async function GET() {
  try {
    const [
      rsi,
      macd,
      vwap,
      ema20,
      trend,
      patternKey,
    ] = await Promise.all([
      getSummary("rsi_band"),
      getSummary("macd_key"),
      getSummary("vwap_key"),
      getSummary("ema20_key"),
      getSummary("trend_key"),
      getSummary("pattern_key"),
    ]);

    return NextResponse.json({
      success: true,
      rsi,
      macd,
      vwap,
      ema20,
      trend,
      patternKey: patternKey.slice(0, 20),
      updatedAt: new Date().toLocaleString("ja-JP", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  } catch (error) {
    console.error("pattern learning summary error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "PATTERN_LEARNING_SUMMARY_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}