import pool from "@/app/lib/postgres";

export type PatternForwardDirection = "BUY" | "SELL" | "NEUTRAL";

export type PatternForwardObservationInput = {
  id: string;
  name: string;
  direction: PatternForwardDirection;
  confidence: number;
  score: number;
};

export type PatternForwardStockInput = {
  code: string;
  price?: number;
  patternObservations?: PatternForwardObservationInput[];
};

export type PatternForwardStats = {
  patternId: string;
  patternName: string;
  direction: PatternForwardDirection;
  sampleCount: number;
  completed1dCount: number;
  completed3dCount: number;
  completed5dCount: number;
  winRate1d: number | null;
  winRate3d: number | null;
  winRate5d: number | null;
  avgDirectionalReturn1d: number | null;
  avgDirectionalReturn3d: number | null;
  avgDirectionalReturn5d: number | null;
  medianDirectionalReturn5d: number | null;
  avgRawReturn1d: number | null;
  avgRawReturn3d: number | null;
  avgRawReturn5d: number | null;
  distinctCodes: number;
  distinctDates: number;
  validationStatus: "COLLECTING" | "PROMISING" | "VALIDATED" | "OBSERVATION_ONLY";
  statusReason: string;
  updatedAt: string;
};

function assertTradeDate(tradeDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) {
    throw new Error(`Invalid trade date: ${tradeDate}`);
  }
}

export async function savePatternForwardObservations(
  tradeDate: string,
  stocks: PatternForwardStockInput[],
): Promise<{ patternForwardSaved: number; patternForwardDetectedStocks: number }> {
  assertTradeDate(tradeDate);

  const rows = stocks.flatMap((stock) => {
    const price = Number(stock.price ?? 0);
    if (!stock.code || !Number.isFinite(price) || price <= 0) return [];

    return (stock.patternObservations ?? [])
      .filter(
        (pattern) =>
          pattern?.id &&
          pattern?.name &&
          ["BUY", "SELL", "NEUTRAL"].includes(pattern.direction),
      )
      .map((pattern) => ({
        tradeDate,
        code: stock.code,
        patternId: pattern.id,
        patternName: pattern.name,
        direction: pattern.direction,
        entryPrice: price,
        confidence: Number.isFinite(pattern.confidence) ? pattern.confidence : null,
        patternScore: Number.isFinite(pattern.score) ? pattern.score : null,
      }));
  });

  if (rows.length === 0) {
    return { patternForwardSaved: 0, patternForwardDetectedStocks: 0 };
  }

  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const base = index * 8;
    values.push(
      row.tradeDate,
      row.code,
      row.patternId,
      row.patternName,
      row.direction,
      row.entryPrice,
      row.confidence,
      row.patternScore,
    );
    return `(${Array.from({ length: 8 }, (_, offset) => `$${base + offset + 1}`).join(", ")})`;
  });

  const result = await pool.query(
    `
    INSERT INTO pattern_forward_observations (
      trade_date,
      code,
      pattern_id,
      pattern_name,
      direction,
      entry_price,
      confidence,
      pattern_score
    )
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (trade_date, code, pattern_id) DO UPDATE SET
      pattern_name = EXCLUDED.pattern_name,
      direction = EXCLUDED.direction,
      entry_price = EXCLUDED.entry_price,
      confidence = EXCLUDED.confidence,
      pattern_score = EXCLUDED.pattern_score,
      updated_at = NOW()
    RETURNING code
    `,
    values,
  );

  return {
    patternForwardSaved: result.rowCount ?? 0,
    patternForwardDetectedStocks: new Set(rows.map((row) => row.code)).size,
  };
}

export async function updatePatternForwardOutcomes(
  targetDate: string,
): Promise<{ patternForwardOutcomesUpdated: number }> {
  assertTradeDate(targetDate);

  const result = await pool.query(
    `
    WITH candidates AS (
      SELECT
        p.id,
        p.direction,
        p.entry_price,
        one.price AS price_1d,
        one.outcome_date AS date_1d,
        three.price AS price_3d,
        three.outcome_date AS date_3d,
        five.price AS price_5d,
        five.outcome_date AS date_5d
      FROM pattern_forward_observations p
      LEFT JOIN LATERAL (
        SELECT d.price, d.date::date AS outcome_date
        FROM daily_stock_results d
        WHERE d.code = p.code
          AND d.date::date > p.trade_date
          AND d.date::date <= $1::date
        ORDER BY d.date::date ASC
        OFFSET 0 LIMIT 1
      ) one ON TRUE
      LEFT JOIN LATERAL (
        SELECT d.price, d.date::date AS outcome_date
        FROM daily_stock_results d
        WHERE d.code = p.code
          AND d.date::date > p.trade_date
          AND d.date::date <= $1::date
        ORDER BY d.date::date ASC
        OFFSET 2 LIMIT 1
      ) three ON TRUE
      LEFT JOIN LATERAL (
        SELECT d.price, d.date::date AS outcome_date
        FROM daily_stock_results d
        WHERE d.code = p.code
          AND d.date::date > p.trade_date
          AND d.date::date <= $1::date
        ORDER BY d.date::date ASC
        OFFSET 4 LIMIT 1
      ) five ON TRUE
      WHERE p.trade_date < $1::date
        AND (p.return_1d IS NULL OR p.return_3d IS NULL OR p.return_5d IS NULL)
    ),
    calculated AS (
      SELECT
        id,
        direction,
        date_1d,
        date_3d,
        date_5d,
        CASE WHEN entry_price > 0 AND price_1d IS NOT NULL
          THEN ROUND((100.0 * (price_1d - entry_price) / entry_price)::numeric, 4)
        END AS return_1d,
        CASE WHEN entry_price > 0 AND price_3d IS NOT NULL
          THEN ROUND((100.0 * (price_3d - entry_price) / entry_price)::numeric, 4)
        END AS return_3d,
        CASE WHEN entry_price > 0 AND price_5d IS NOT NULL
          THEN ROUND((100.0 * (price_5d - entry_price) / entry_price)::numeric, 4)
        END AS return_5d
      FROM candidates
    ),
    updated AS (
      UPDATE pattern_forward_observations p
      SET
        return_1d = COALESCE(p.return_1d, c.return_1d),
        outcome_1d_date = COALESCE(p.outcome_1d_date, c.date_1d),
        success_1d = COALESCE(
          p.success_1d,
          CASE
            WHEN c.return_1d IS NULL OR c.direction = 'NEUTRAL' THEN NULL
            WHEN c.direction = 'BUY' THEN c.return_1d > 0
            WHEN c.direction = 'SELL' THEN c.return_1d < 0
          END
        ),
        return_3d = COALESCE(p.return_3d, c.return_3d),
        outcome_3d_date = COALESCE(p.outcome_3d_date, c.date_3d),
        success_3d = COALESCE(
          p.success_3d,
          CASE
            WHEN c.return_3d IS NULL OR c.direction = 'NEUTRAL' THEN NULL
            WHEN c.direction = 'BUY' THEN c.return_3d > 0
            WHEN c.direction = 'SELL' THEN c.return_3d < 0
          END
        ),
        return_5d = COALESCE(p.return_5d, c.return_5d),
        outcome_5d_date = COALESCE(p.outcome_5d_date, c.date_5d),
        success_5d = COALESCE(
          p.success_5d,
          CASE
            WHEN c.return_5d IS NULL OR c.direction = 'NEUTRAL' THEN NULL
            WHEN c.direction = 'BUY' THEN c.return_5d > 0
            WHEN c.direction = 'SELL' THEN c.return_5d < 0
          END
        ),
        updated_at = NOW()
      FROM calculated c
      WHERE p.id = c.id
        AND (c.return_1d IS NOT NULL OR c.return_3d IS NOT NULL OR c.return_5d IS NOT NULL)
      RETURNING p.id
    )
    SELECT COUNT(*)::int AS updated_count
    FROM updated
    `,
    [targetDate],
  );

  return {
    patternForwardOutcomesUpdated: Number(result.rows[0]?.updated_count ?? 0),
  };
}

export async function refreshPatternForwardStats(): Promise<void> {
  await pool.query(`
    INSERT INTO pattern_forward_stats (
      pattern_id,
      pattern_name,
      direction,
      sample_count,
      completed_1d_count,
      completed_3d_count,
      completed_5d_count,
      win_rate_1d,
      win_rate_3d,
      win_rate_5d,
      avg_directional_return_1d,
      avg_directional_return_3d,
      avg_directional_return_5d,
      median_directional_return_5d,
      avg_raw_return_1d,
      avg_raw_return_3d,
      avg_raw_return_5d,
      distinct_codes,
      distinct_dates,
      validation_status,
      status_reason,
      updated_at
    )
    SELECT
      pattern_id,
      MAX(pattern_name) AS pattern_name,
      MAX(direction) AS direction,
      COUNT(*)::int AS sample_count,
      COUNT(return_1d)::int AS completed_1d_count,
      COUNT(return_3d)::int AS completed_3d_count,
      COUNT(return_5d)::int AS completed_5d_count,
      ROUND(100.0 * COUNT(*) FILTER (WHERE success_1d IS TRUE) / NULLIF(COUNT(success_1d), 0), 2) AS win_rate_1d,
      ROUND(100.0 * COUNT(*) FILTER (WHERE success_3d IS TRUE) / NULLIF(COUNT(success_3d), 0), 2) AS win_rate_3d,
      ROUND(100.0 * COUNT(*) FILTER (WHERE success_5d IS TRUE) / NULLIF(COUNT(success_5d), 0), 2) AS win_rate_5d,
      ROUND(AVG(CASE
        WHEN direction = 'BUY' THEN return_1d
        WHEN direction = 'SELL' THEN -return_1d
      END), 4) AS avg_directional_return_1d,
      ROUND(AVG(CASE
        WHEN direction = 'BUY' THEN return_3d
        WHEN direction = 'SELL' THEN -return_3d
      END), 4) AS avg_directional_return_3d,
      ROUND(AVG(CASE
        WHEN direction = 'BUY' THEN return_5d
        WHEN direction = 'SELL' THEN -return_5d
      END), 4) AS avg_directional_return_5d,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY CASE
          WHEN direction = 'BUY' THEN return_5d
          WHEN direction = 'SELL' THEN -return_5d
        END
      )::numeric, 4) AS median_directional_return_5d,
      ROUND(AVG(return_1d), 4) AS avg_raw_return_1d,
      ROUND(AVG(return_3d), 4) AS avg_raw_return_3d,
      ROUND(AVG(return_5d), 4) AS avg_raw_return_5d,
      COUNT(DISTINCT code)::int AS distinct_codes,
      COUNT(DISTINCT trade_date)::int AS distinct_dates,
      CASE
        WHEN MAX(direction) = 'NEUTRAL' THEN 'OBSERVATION_ONLY'
        WHEN COUNT(return_5d) >= 50
          AND COUNT(DISTINCT code) >= 30
          AND COUNT(DISTINCT trade_date) >= 15
          AND 100.0 * COUNT(*) FILTER (WHERE success_5d IS TRUE) / NULLIF(COUNT(success_5d), 0) >= 60
          AND AVG(CASE WHEN direction = 'BUY' THEN return_5d WHEN direction = 'SELL' THEN -return_5d END) >= 0.5
          AND PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY CASE WHEN direction = 'BUY' THEN return_5d WHEN direction = 'SELL' THEN -return_5d END
          ) > 0
          THEN 'VALIDATED'
        WHEN COUNT(return_5d) >= 20
          AND COUNT(DISTINCT code) >= 15
          AND COUNT(DISTINCT trade_date) >= 8
          AND 100.0 * COUNT(*) FILTER (WHERE success_5d IS TRUE) / NULLIF(COUNT(success_5d), 0) >= 55
          AND AVG(CASE WHEN direction = 'BUY' THEN return_5d WHEN direction = 'SELL' THEN -return_5d END) > 0
          THEN 'PROMISING'
        ELSE 'COLLECTING'
      END AS validation_status,
      CASE
        WHEN MAX(direction) = 'NEUTRAL'
          THEN 'Direction-neutral pattern: collect follow-up returns without win/loss scoring'
        WHEN COUNT(return_5d) >= 50
          AND COUNT(DISTINCT code) >= 30
          AND COUNT(DISTINCT trade_date) >= 15
          AND 100.0 * COUNT(*) FILTER (WHERE success_5d IS TRUE) / NULLIF(COUNT(success_5d), 0) >= 60
          AND AVG(CASE WHEN direction = 'BUY' THEN return_5d WHEN direction = 'SELL' THEN -return_5d END) >= 0.5
          AND PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY CASE WHEN direction = 'BUY' THEN return_5d WHEN direction = 'SELL' THEN -return_5d END
          ) > 0
          THEN 'Forward 5-day validation criteria passed'
        WHEN COUNT(return_5d) >= 20
          AND COUNT(DISTINCT code) >= 15
          AND COUNT(DISTINCT trade_date) >= 8
          AND 100.0 * COUNT(*) FILTER (WHERE success_5d IS TRUE) / NULLIF(COUNT(success_5d), 0) >= 55
          AND AVG(CASE WHEN direction = 'BUY' THEN return_5d WHEN direction = 'SELL' THEN -return_5d END) > 0
          THEN 'Early positive forward evidence'
        ELSE 'Collecting independent 1/3/5-day forward outcomes'
      END AS status_reason,
      NOW()
    FROM pattern_forward_observations
    GROUP BY pattern_id
    ON CONFLICT (pattern_id) DO UPDATE SET
      pattern_name = EXCLUDED.pattern_name,
      direction = EXCLUDED.direction,
      sample_count = EXCLUDED.sample_count,
      completed_1d_count = EXCLUDED.completed_1d_count,
      completed_3d_count = EXCLUDED.completed_3d_count,
      completed_5d_count = EXCLUDED.completed_5d_count,
      win_rate_1d = EXCLUDED.win_rate_1d,
      win_rate_3d = EXCLUDED.win_rate_3d,
      win_rate_5d = EXCLUDED.win_rate_5d,
      avg_directional_return_1d = EXCLUDED.avg_directional_return_1d,
      avg_directional_return_3d = EXCLUDED.avg_directional_return_3d,
      avg_directional_return_5d = EXCLUDED.avg_directional_return_5d,
      median_directional_return_5d = EXCLUDED.median_directional_return_5d,
      avg_raw_return_1d = EXCLUDED.avg_raw_return_1d,
      avg_raw_return_3d = EXCLUDED.avg_raw_return_3d,
      avg_raw_return_5d = EXCLUDED.avg_raw_return_5d,
      distinct_codes = EXCLUDED.distinct_codes,
      distinct_dates = EXCLUDED.distinct_dates,
      validation_status = EXCLUDED.validation_status,
      status_reason = EXCLUDED.status_reason,
      updated_at = NOW()
  `);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getPatternForwardStats(): Promise<PatternForwardStats[]> {
  const result = await pool.query(`
    SELECT *
    FROM pattern_forward_stats
    ORDER BY
      CASE validation_status
        WHEN 'VALIDATED' THEN 1
        WHEN 'PROMISING' THEN 2
        WHEN 'COLLECTING' THEN 3
        ELSE 4
      END,
      win_rate_5d DESC NULLS LAST,
      completed_5d_count DESC,
      pattern_id ASC
  `);

  return result.rows.map((row) => ({
    patternId: String(row.pattern_id),
    patternName: String(row.pattern_name),
    direction: row.direction as PatternForwardDirection,
    sampleCount: Number(row.sample_count ?? 0),
    completed1dCount: Number(row.completed_1d_count ?? 0),
    completed3dCount: Number(row.completed_3d_count ?? 0),
    completed5dCount: Number(row.completed_5d_count ?? 0),
    winRate1d: numberOrNull(row.win_rate_1d),
    winRate3d: numberOrNull(row.win_rate_3d),
    winRate5d: numberOrNull(row.win_rate_5d),
    avgDirectionalReturn1d: numberOrNull(row.avg_directional_return_1d),
    avgDirectionalReturn3d: numberOrNull(row.avg_directional_return_3d),
    avgDirectionalReturn5d: numberOrNull(row.avg_directional_return_5d),
    medianDirectionalReturn5d: numberOrNull(row.median_directional_return_5d),
    avgRawReturn1d: numberOrNull(row.avg_raw_return_1d),
    avgRawReturn3d: numberOrNull(row.avg_raw_return_3d),
    avgRawReturn5d: numberOrNull(row.avg_raw_return_5d),
    distinctCodes: Number(row.distinct_codes ?? 0),
    distinctDates: Number(row.distinct_dates ?? 0),
    validationStatus: row.validation_status,
    statusReason: String(row.status_reason ?? ""),
    updatedAt: String(row.updated_at),
  }));
}


export async function getValidatedPatternForwardStatsMap(
  patternIds: string[],
): Promise<Map<string, PatternForwardStats>> {
  const map = new Map<string, PatternForwardStats>();
  const uniqueIds = Array.from(new Set(patternIds.filter(Boolean)));

  if (uniqueIds.length === 0) return map;

  const result = await pool.query(
    `
    SELECT *
    FROM pattern_forward_stats
    WHERE validation_status = 'VALIDATED'
      AND direction IN ('BUY', 'SELL')
      AND pattern_id = ANY($1::text[])
    `,
    [uniqueIds],
  );

  for (const row of result.rows) {
    const stat: PatternForwardStats = {
      patternId: String(row.pattern_id),
      patternName: String(row.pattern_name),
      direction: row.direction as PatternForwardDirection,
      sampleCount: Number(row.sample_count ?? 0),
      completed1dCount: Number(row.completed_1d_count ?? 0),
      completed3dCount: Number(row.completed_3d_count ?? 0),
      completed5dCount: Number(row.completed_5d_count ?? 0),
      winRate1d: numberOrNull(row.win_rate_1d),
      winRate3d: numberOrNull(row.win_rate_3d),
      winRate5d: numberOrNull(row.win_rate_5d),
      avgDirectionalReturn1d: numberOrNull(row.avg_directional_return_1d),
      avgDirectionalReturn3d: numberOrNull(row.avg_directional_return_3d),
      avgDirectionalReturn5d: numberOrNull(row.avg_directional_return_5d),
      medianDirectionalReturn5d: numberOrNull(row.median_directional_return_5d),
      avgRawReturn1d: numberOrNull(row.avg_raw_return_1d),
      avgRawReturn3d: numberOrNull(row.avg_raw_return_3d),
      avgRawReturn5d: numberOrNull(row.avg_raw_return_5d),
      distinctCodes: Number(row.distinct_codes ?? 0),
      distinctDates: Number(row.distinct_dates ?? 0),
      validationStatus: row.validation_status,
      statusReason: String(row.status_reason ?? ""),
      updatedAt: String(row.updated_at),
    };
    map.set(stat.patternId, stat);
  }

  return map;
}
