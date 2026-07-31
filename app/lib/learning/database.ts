import pool from "@/app/lib/postgres";

export type LearningStats = {
  code: string;
  wins: number;
  losses: number;
  holds: number;
  judgedCount: number;
  winRate: number;
  totalProfitYen: number;
};

export type PatternStats = {
  patternKey: string;
  win: number;
  lose: number;
};

export type WeightRule = {
  ruleKey: string;
  bonus: number;
  winRate: number;
  sampleCount: number;
  confidence: number;
};

export type SectorWeightRule = {
  ruleKey: string;
  bonus: number;
  winRate: number;
  sampleCount: number;
  confidence: number;
};

export type SectorStats = {
  sectorKey: string;
  win: number;
  lose: number;
};

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function calcWinRate(win: number, lose: number): number {
  const judged = win + lose;
  if (judged <= 0) return 0;
  return Math.round((win / judged) * 1000) / 10;
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function getLatestMarketPattern(): Promise<string> {
  const { rows } = await pool.query(`
    SELECT market_pattern
    FROM market_learning_logs
    WHERE market_pattern IS NOT NULL
    ORDER BY trade_date DESC
    LIMIT 1
  `);

  return rows[0]?.market_pattern ? String(rows[0].market_pattern) : "NO_MARKET";
}

export async function getLatestMarketBonus(): Promise<{
  bonus: number;
  winRate: number;
  confidence: number;
}> {
  const { rows } = await pool.query(`
    SELECT
      ai_bonus,
      win_rate,
      confidence
    FROM market_learning_logs
    WHERE ai_bonus IS NOT NULL
    ORDER BY trade_date DESC
    LIMIT 1
  `);

  return {
    bonus: toNumber(rows[0]?.ai_bonus),
    winRate: toNumber(rows[0]?.win_rate),
    confidence: toNumber(rows[0]?.confidence),
  };
}

export async function getLearningStatsMap(
  codes: string[]
): Promise<Map<string, LearningStats>> {
  const map = new Map<string, LearningStats>();
  const uniqueCodes = uniqueNonEmpty(codes);

  if (uniqueCodes.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      code,
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS wins,
      COUNT(*) FILTER (WHERE result = 'LOSE')::int AS losses,
      COUNT(*) FILTER (WHERE result = 'HOLD')::int AS holds,
      COALESCE(
        SUM(ROUND((next_price - price) * 100)) FILTER (
          WHERE result IN ('WIN', 'LOSE', 'HOLD')
        ),
        0
      ) AS total_profit_yen
    FROM daily_stock_results
    WHERE code = ANY($1)
      AND date::date >= CURRENT_DATE - INTERVAL '30 days'
      AND date::date <= CURRENT_DATE
      AND result IN ('WIN', 'LOSE', 'HOLD')
      AND next_price IS NOT NULL
      AND change_percent IS NOT NULL
    GROUP BY code
    `,
    [uniqueCodes]
  );

  for (const row of rows) {
    const code = String(row.code);
    const wins = toNumber(row.wins);
    const losses = toNumber(row.losses);
    const holds = toNumber(row.holds);

    map.set(code, {
      code,
      wins,
      losses,
      holds,
      judgedCount: wins + losses + holds,
      winRate: calcWinRate(wins, losses),
      totalProfitYen: toNumber(row.total_profit_yen),
    });
  }

  return map;
}

export async function getPatternStatsMap(
  patternKeys: string[]
): Promise<Map<string, PatternStats>> {
  const map = new Map<string, PatternStats>();
  const uniqueKeys = uniqueNonEmpty(patternKeys);

  if (uniqueKeys.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      pattern_key,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS win,
      SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END) AS lose
    FROM pattern_learning_logs
    WHERE pattern_key = ANY($1)
    GROUP BY pattern_key
    `,
    [uniqueKeys]
  );

  for (const row of rows) {
    const patternKey = String(row.pattern_key);

    map.set(patternKey, {
      patternKey,
      win: toNumber(row.win),
      lose: toNumber(row.lose),
    });
  }

  return map;
}

export async function getWeightRuleMap(
  patternKeys: string[]
): Promise<Map<string, WeightRule>> {
  const map = new Map<string, WeightRule>();
  const uniqueKeys = uniqueNonEmpty(patternKeys);

  if (uniqueKeys.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      rule_key,
      bonus,
      win_rate,
      sample_count,
      confidence
    FROM ai_power_weight_rules
    WHERE
      rule_type = 'pattern'
      AND is_active = true
      AND rule_key = ANY($1)
    `,
    [uniqueKeys]
  );

  for (const row of rows) {
    const ruleKey = String(row.rule_key);

    map.set(ruleKey, {
      ruleKey,
      bonus: toNumber(row.bonus),
      winRate: toNumber(row.win_rate),
      sampleCount: toNumber(row.sample_count),
      confidence: toNumber(row.confidence),
    });
  }

  return map;
}

export async function getSectorWeightRuleMap(
  sectorKeys: string[]
): Promise<Map<string, SectorWeightRule>> {
  const map = new Map<string, SectorWeightRule>();
  const uniqueKeys = uniqueNonEmpty(sectorKeys);

  if (uniqueKeys.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      rule_key,
      bonus,
      win_rate,
      sample_count,
      confidence
    FROM ai_power_weight_rules
    WHERE
      rule_type = 'SECTOR'
      AND is_active = true
      AND rule_key = ANY($1)
    `,
    [uniqueKeys]
  );

  for (const row of rows) {
    const ruleKey = String(row.rule_key);

    map.set(ruleKey, {
      ruleKey,
      bonus: toNumber(row.bonus),
      winRate: toNumber(row.win_rate),
      sampleCount: toNumber(row.sample_count),
      confidence: toNumber(row.confidence),
    });
  }

  return map;
}

export async function getSectorStatsMap(
  sectorKeys: string[]
): Promise<Map<string, SectorStats>> {
  const map = new Map<string, SectorStats>();
  const uniqueKeys = uniqueNonEmpty(sectorKeys);

  if (uniqueKeys.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      sector_key,
      SUM(win_count) AS win,
      SUM(lose_count) AS lose
    FROM sector_learning_logs
    WHERE sector_key = ANY($1)
    GROUP BY sector_key
    `,
    [uniqueKeys]
  );

  for (const row of rows) {
    const sectorKey = String(row.sector_key);

    map.set(sectorKey, {
      sectorKey,
      win: toNumber(row.win),
      lose: toNumber(row.lose),
    });
  }

  return map;
}
