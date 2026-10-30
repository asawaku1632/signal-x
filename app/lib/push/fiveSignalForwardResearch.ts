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
    WITH observations AS (
      SELECT trade_date, code, 'MM_V1'::text AS research, result_5d
      FROM public.momentum_memory_observations
      WHERE validation_mode = 'FORWARD' AND observation_flag = true
      UNION ALL
      SELECT trade_date, code, 'HAP_V1', result_5d
      FROM public.high_ai_pullback_observations
      WHERE validation_mode = 'FORWARD' AND observation_flag = true AND signal_version = 'HAP_V1'
      UNION ALL
      SELECT trade_date, code, 'AIR_V1', result_5d
      FROM public.ai_reversal_observations
      WHERE validation_mode = 'FORWARD' AND observation_flag = true AND signal_version = 'AIR_V1'
      UNION ALL
      SELECT trade_date, code, 'TPR_V1', result_5d
      FROM public.trend_pullback_reversal_observations
      WHERE validation_mode = 'FORWARD' AND observation_flag = true AND signal_version = 'TPR_V1'
    )
    SELECT trade_date, code, research, result_5d FROM observations
    WHERE code <> '9984' AND code ~ '^[0-9]{4}$|^[0-9]{3}[A-Z]
    ORDER BY trade_date DESC, code, research
    LIMIT $1
  `, [size]);
  return result.rows.map((row) => ({
    tradeDate: row.trade_date instanceof Date
      ? row.trade_date.toISOString().slice(0, 10)
      : String(row.trade_date).slice(0, 10),
    code: row.code,
    research: row.research,
    result5d: row.result_5d === null || !Number.isFinite(Number(row.result_5d)) ? null : Number(row.result_5d),
  }));
}

    ORDER BY trade_date DESC, code, research
    LIMIT $1
  `, [size]);
  return result.rows.map((row) => ({
    tradeDate: row.trade_date instanceof Date
      ? row.trade_date.toISOString().slice(0, 10)
      : String(row.trade_date).slice(0, 10),
    code: row.code,
    research: row.research,
    result5d: row.result_5d === null || !Number.isFinite(Number(row.result_5d)) ? null : Number(row.result_5d),
  }));
}
