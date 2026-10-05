import pool from "@/app/lib/postgres";

export type MomentumMemorySaveResult = {
  momentumMemorySaved: number;
  momentumMemoryFlagged: number;
};

export async function saveMomentumMemoryObservations(
  targetDate: string,
): Promise<MomentumMemorySaveResult> {
  const result = await pool.query(
    `
    WITH current_rows AS (
      SELECT code, trade_date, ai_power
      FROM pattern_learning_logs
      WHERE trade_date = $1::date
    ),
    enriched AS (
      SELECT
        c.code,
        c.trade_date,
        c.ai_power AS current_ai_power,
        (
          SELECT AVG(x.ai_power)
          FROM (
            SELECT p.ai_power
            FROM pattern_learning_logs p
            WHERE p.code = c.code
              AND p.trade_date < c.trade_date
            ORDER BY p.trade_date DESC
            LIMIT 3
          ) x
        ) AS prev3_avg_ai_power,
        (
          SELECT MAX(x.ai_power)
          FROM (
            SELECT p.ai_power
            FROM pattern_learning_logs p
            WHERE p.code = c.code
              AND p.trade_date < c.trade_date
            ORDER BY p.trade_date DESC
            LIMIT 3
          ) x
        ) AS prev3_max_ai_power,
        (
          SELECT COUNT(*)::smallint
          FROM (
            SELECT p.ai_power
            FROM pattern_learning_logs p
            WHERE p.code = c.code
              AND p.trade_date < c.trade_date
            ORDER BY p.trade_date DESC
            LIMIT 3
          ) x
          WHERE x.ai_power >= 90
        ) AS prev3_high_count,
        (
          SELECT ARRAY_AGG(x.result ORDER BY x.trade_date DESC)
          FROM (
            SELECT p.trade_date, p.result
            FROM pattern_learning_logs p
            WHERE p.code = c.code
              AND p.trade_date < c.trade_date
              AND p.result IN ('WIN', 'LOSE', 'HOLD')
            ORDER BY p.trade_date DESC
            LIMIT 2
          ) x
        ) AS settled_results
      FROM current_rows c
    ),
    upserted AS (
      INSERT INTO momentum_memory_observations (
        trade_date,
        code,
        current_ai_power,
        prev3_avg_ai_power,
        prev3_max_ai_power,
        prev3_high_count,
        last_settled_result_1,
        last_settled_result_2,
        ai_power_drop_from_peak,
        observation_flag,
        updated_at
      )
      SELECT
        trade_date,
        code,
        current_ai_power,
        prev3_avg_ai_power,
        prev3_max_ai_power,
        COALESCE(prev3_high_count, 0),
        settled_results[1],
        settled_results[2],
        CASE
          WHEN prev3_max_ai_power IS NULL OR current_ai_power IS NULL THEN NULL
          ELSE prev3_max_ai_power - current_ai_power
        END,
        (
          prev3_avg_ai_power >= 85
          AND prev3_max_ai_power >= 90
          AND current_ai_power <= 50
          AND settled_results[1] = 'WIN'
          AND settled_results[2] = 'WIN'
        ),
        NOW()
      FROM enriched
      ON CONFLICT (trade_date, code) DO UPDATE SET
        current_ai_power = EXCLUDED.current_ai_power,
        prev3_avg_ai_power = EXCLUDED.prev3_avg_ai_power,
        prev3_max_ai_power = EXCLUDED.prev3_max_ai_power,
        prev3_high_count = EXCLUDED.prev3_high_count,
        last_settled_result_1 = EXCLUDED.last_settled_result_1,
        last_settled_result_2 = EXCLUDED.last_settled_result_2,
        ai_power_drop_from_peak = EXCLUDED.ai_power_drop_from_peak,
        observation_flag = EXCLUDED.observation_flag,
        updated_at = NOW()
      RETURNING observation_flag
    )
    SELECT
      COUNT(*)::int AS saved_count,
      COUNT(*) FILTER (WHERE observation_flag)::int AS flagged_count
    FROM upserted
    `,
    [targetDate],
  );

  return {
    momentumMemorySaved: Number(result.rows[0]?.saved_count ?? 0),
    momentumMemoryFlagged: Number(result.rows[0]?.flagged_count ?? 0),
  };
}
