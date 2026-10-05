import pool from "@/app/lib/postgres";

export type MomentumMemorySaveResult = {
  momentumMemorySaved: number;
  momentumMemoryFlagged: number;
};

export type MomentumMemoryOutcomeResult = {
  momentumMemoryOutcomesUpdated: number;
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
          SELECT p.macd_key
          FROM pattern_learning_logs p
          WHERE p.code = c.code AND p.trade_date = c.trade_date
          ORDER BY p.created_at DESC
          LIMIT 1
        ) AS current_macd_key,
        (
          SELECT AVG(x.ai_power)
          FROM (
            SELECT p.ai_power
            FROM pattern_learning_logs p
            WHERE p.code = c.code AND p.trade_date < c.trade_date
            ORDER BY p.trade_date DESC
            LIMIT 3
          ) x
        ) AS prev3_avg_ai_power,
        (
          SELECT MAX(x.ai_power)
          FROM (
            SELECT p.ai_power
            FROM pattern_learning_logs p
            WHERE p.code = c.code AND p.trade_date < c.trade_date
            ORDER BY p.trade_date DESC
            LIMIT 3
          ) x
        ) AS prev3_max_ai_power,
        (
          SELECT COUNT(*)::smallint
          FROM (
            SELECT p.ai_power
            FROM pattern_learning_logs p
            WHERE p.code = c.code AND p.trade_date < c.trade_date
            ORDER BY p.trade_date DESC
            LIMIT 3
          ) x
          WHERE x.ai_power >= 90
        ) AS prev3_high_count
      FROM current_rows c
    ),
    upserted AS (
      INSERT INTO momentum_memory_observations (
        trade_date, code, current_ai_power, prev3_avg_ai_power,
        prev3_max_ai_power, prev3_high_count, ai_power_drop_from_peak,
        observation_flag, profile_key, research_score,
        confirmation_key, confirmation_score, updated_at
      )
      SELECT
        trade_date,
        code,
        current_ai_power,
        prev3_avg_ai_power,
        prev3_max_ai_power,
        COALESCE(prev3_high_count, 0),
        CASE
          WHEN prev3_max_ai_power IS NULL OR current_ai_power IS NULL THEN NULL
          ELSE prev3_max_ai_power - current_ai_power
        END,
        (
          prev3_avg_ai_power >= 85
          AND prev3_max_ai_power >= 90
          AND current_ai_power <= 50
        ),
        CASE
          WHEN prev3_avg_ai_power >= 95 AND COALESCE(prev3_high_count, 0) = 2
            THEN 'EXPLOSIVE_REBOUND'
          WHEN current_ai_power >= 30 AND current_ai_power < 40
            AND (prev3_max_ai_power - current_ai_power) >= 65
            THEN 'STABLE_REBOUND'
          ELSE 'BASE'
        END,
        CASE
          WHEN prev3_avg_ai_power >= 95 AND COALESCE(prev3_high_count, 0) = 2 THEN 2
          WHEN current_ai_power >= 30 AND current_ai_power < 40
            AND (prev3_max_ai_power - current_ai_power) >= 65 THEN 1
          ELSE 0
        END,
        CASE WHEN current_macd_key = 'MACD_GC' THEN 'MACD_GC' ELSE 'NONE' END,
        CASE WHEN current_macd_key = 'MACD_GC' THEN 1 ELSE 0 END,
        NOW()
      FROM enriched
      ON CONFLICT (trade_date, code) DO UPDATE SET
        current_ai_power = EXCLUDED.current_ai_power,
        prev3_avg_ai_power = EXCLUDED.prev3_avg_ai_power,
        prev3_max_ai_power = EXCLUDED.prev3_max_ai_power,
        prev3_high_count = EXCLUDED.prev3_high_count,
        ai_power_drop_from_peak = EXCLUDED.ai_power_drop_from_peak,
        observation_flag = EXCLUDED.observation_flag,
        profile_key = EXCLUDED.profile_key,
        research_score = EXCLUDED.research_score,
        confirmation_key = EXCLUDED.confirmation_key,
        confirmation_score = EXCLUDED.confirmation_score,
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

export async function updateMomentumMemoryOutcomes(
  targetDate: string,
): Promise<MomentumMemoryOutcomeResult> {
  const result = await pool.query(
    `
    WITH candidates AS (
      SELECT
        m.id,
        base.price AS base_price,
        (
          SELECT d.price
          FROM daily_stock_results d
          WHERE d.code = m.code
            AND d.date::date > m.trade_date
            AND d.date::date <= $1::date
          ORDER BY d.date::date ASC
          OFFSET 0 LIMIT 1
        ) AS price_1d,
        (
          SELECT d.price
          FROM daily_stock_results d
          WHERE d.code = m.code
            AND d.date::date > m.trade_date
            AND d.date::date <= $1::date
          ORDER BY d.date::date ASC
          OFFSET 2 LIMIT 1
        ) AS price_3d,
        (
          SELECT d.price
          FROM daily_stock_results d
          WHERE d.code = m.code
            AND d.date::date > m.trade_date
            AND d.date::date <= $1::date
          ORDER BY d.date::date ASC
          OFFSET 4 LIMIT 1
        ) AS price_5d
      FROM momentum_memory_observations m
      JOIN daily_stock_results base
        ON base.code = m.code
       AND base.date::date = m.trade_date
      WHERE m.observation_flag = TRUE
        AND m.trade_date < $1::date
        AND (m.result_1d IS NULL OR m.result_3d IS NULL OR m.result_5d IS NULL)
    ),
    updated AS (
      UPDATE momentum_memory_observations m
      SET
        result_1d = COALESCE(
          m.result_1d,
          CASE WHEN c.base_price > 0 AND c.price_1d IS NOT NULL
            THEN ROUND((((c.price_1d - c.base_price) / c.base_price) * 100)::numeric, 4)
          END
        ),
        result_3d = COALESCE(
          m.result_3d,
          CASE WHEN c.base_price > 0 AND c.price_3d IS NOT NULL
            THEN ROUND((((c.price_3d - c.base_price) / c.base_price) * 100)::numeric, 4)
          END
        ),
        result_5d = COALESCE(
          m.result_5d,
          CASE WHEN c.base_price > 0 AND c.price_5d IS NOT NULL
            THEN ROUND((((c.price_5d - c.base_price) / c.base_price) * 100)::numeric, 4)
          END
        ),
        updated_at = NOW()
      FROM candidates c
      WHERE m.id = c.id
        AND (c.price_1d IS NOT NULL OR c.price_3d IS NOT NULL OR c.price_5d IS NOT NULL)
      RETURNING m.id
    )
    SELECT COUNT(*)::int AS updated_count FROM updated
    `,
    [targetDate],
  );

  return {
    momentumMemoryOutcomesUpdated: Number(result.rows[0]?.updated_count ?? 0),
  };
}
