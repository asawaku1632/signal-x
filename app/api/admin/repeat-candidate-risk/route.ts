import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Research only: no writes, no notification or trading decision side effects.
const SQL = `
WITH candidate_history AS (
  SELECT trade_date, code, name, ai_power, entry_price, return_5d,
    captured_at, outcome_5d_date,
    ROW_NUMBER() OVER (PARTITION BY code ORDER BY trade_date) AS candidate_number,
    LAG(trade_date) OVER (PARTITION BY code ORDER BY trade_date) AS previous_candidate_date,
    LAG(entry_price) OVER (PARTITION BY code ORDER BY trade_date) AS previous_candidate_price
  FROM public.swing_universe_observations
  WHERE rule_version = 'ai_power_only_v1' AND decision_status = 'CANDIDATE'
)
SELECT trade_date::text AS trade_date, code, name, ai_power, entry_price,
  return_5d, outcome_5d_date::text AS outcome_5d_date, captured_at,
  candidate_number, previous_candidate_date::text AS previous_candidate_date,
  previous_candidate_price,
  ROUND(100 * (entry_price - previous_candidate_price) / NULLIF(previous_candidate_price, 0), 6)
    AS previous_candidate_change_pct
FROM candidate_history
WHERE candidate_number > 1 AND previous_candidate_price > 0 AND ai_power >= 90
ORDER BY trade_date DESC, code ASC
LIMIT 1001
`;

export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "管理者権限が必要です" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const result = await pool.query(SQL);
    return NextResponse.json({
      success: true, fetchedAt: new Date().toISOString(), rows: result.rows.slice(0, 1000),
      note: "研究専用。過去の同一銘柄CANDIDATE保存価格との比較です。日足終値・売買可能価格・予測力を保証せず、履歴の更新や本番判定への反映は行いません。",
      truncated: result.rows.length > 1000,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[repeat-candidate-risk] read-only research failed", error);
    return NextResponse.json({ success: false, error: "研究データを取得できませんでした" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
