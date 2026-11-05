import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import pool from "@/app/lib/postgres";
import { calculateStockOutcomeRates } from "@/app/lib/learning/stockWinRateMath";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Scope = "all" | "recent30";

const query = [
  "WITH numbered AS (",
  "  SELECT code, name, date, result,",
  "    ROW_NUMBER() OVER (",
  "      PARTITION BY code",
  "      ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST, id DESC",
  "    ) AS recent_position",
  "  FROM daily_stock_results",
  "  WHERE code IS NOT NULL AND code <> ''",
  "), scoped AS (",
  "  SELECT code, name, date, result FROM numbered",
  "  WHERE $1::text = 'all' OR recent_position <= 30",
  ")",
  "SELECT code,",
  "  COALESCE(MAX(NULLIF(name, '')), code) AS name,",
  "  COUNT(*)::int AS total,",
  "  COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,",
  "  COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,",
  "  COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold,",
  "  COUNT(*) FILTER (WHERE result = 'UNKNOWN')::int AS unknown,",
  "  MAX(date) AS latest_date",
  "FROM scoped",
  "GROUP BY code",
  "ORDER BY code"
].join("\n");

export async function GET(request: Request) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "Administrator access required" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const scope = new URL(request.url).searchParams.get("scope") ?? "all";
  if (scope !== "all" && scope !== "recent30") {
    return NextResponse.json(
      { success: false, error: "Invalid period" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const { rows } = await pool.query(query, [scope as Scope]);
    const ranking = rows.map((row) => {
      const win = Number(row.win);
      const lose = Number(row.lose);
      const hold = Number(row.hold);
      return {
        code: String(row.code),
        name: String(row.name ?? row.code),
        total: Number(row.total),
        win,
        lose,
        hold,
        unknown: Number(row.unknown),
        ...calculateStockOutcomeRates(win, lose, hold),
        latestDate: row.latest_date ? String(row.latest_date).slice(0, 10) : null,
      };
    });

    return NextResponse.json(
      {
        success: true, scope, count: ranking.length, ranking,
        updatedAt: new Date().toISOString(),
        definitions: {
          horizon: "保存日の翌東証営業日の保存価格との比較（実際の約定価格ではありません）",
          win: "翌営業日の比較価格が保存価格より2%以上上昇",
          lose: "翌営業日の比較価格が保存価格より2%以上下落",
          hold: "騰落率が-2%より大きく+2%未満",
          winRate: "WIN / (WIN + LOSE)。HOLD・未判定を除く条件付き比率",
          winAmongAllRate: "WIN / (WIN + LOSE + HOLD)。未判定のみ除く+2%達成率",
        },
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("admin stock win rate ranking error:", error);
    return NextResponse.json(
      { success: false, error: "勝敗ランキングを取得できませんでした" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
