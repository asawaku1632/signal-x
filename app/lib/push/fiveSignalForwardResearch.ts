import "server-only";
import pool from "@/app/lib/postgres";

export type ForwardResearchRow = {
  tradeDate: string;
  code: string;
  research: string;
  result5d: number | null;
};

export async function getFiveSignalForwardResearch(limit = 100): Promise<ForwardResearchRow[]> {
  const size = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, 200)) : 100;
  const result = await pool.query<{
    trade_date: string | Date;
    code: string;
    research: string;
    result_5d: string | number | null;
  }>(`
    SELECT trade_date, code, 'MM_V1' AS research, result_5d
    FROM public.momentum_memory_observations
    WHERE validation_mode = 'FORWARD' AND observation_flag = true
      AND code <> '9984'
    ORDER BY trade_date DESC, code
    LIMIT $1
  `, [size]);
  return result.rows.map((row) => ({
    tradeDate: row.trade_date instanceof Date
      ? row.trade_date.toISOString().slice(0, 10)
      : String(row.trade_date).slice(0, 10),
    code: row.code,
    research: row.research,
    result5d: row.result_5d === null ? null : Number(row.result_5d),
  }));
}
