import pool from "@/app/lib/postgres";

export type LearningStats = {
  code: string;
  win: number;
  lose: number;
  winRate: number;
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

export async function getLatestMarketPattern() {
  const { rows } = await pool.query(`
    SELECT market_pattern
    FROM market_learning_logs
    WHERE market_pattern IS NOT NULL
    ORDER BY trade_date DESC
    LIMIT 1
  `);

  return rows[0]?.market_pattern
    ? String(rows[0].market_pattern)
    : "NO_MARKET";
}

export async function getLatestMarketBonus() {
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
    bonus: Number(rows[0]?.ai_bonus ?? 0),
    winRate: Number(rows[0]?.win_rate ?? 0),
    confidence: Number(rows[0]?.confidence ?? 0),
  };
}

export async function getLearningStatsMap(codes: string[]) {
  const map = new Map<string, LearningStats>();

  if (codes.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      code,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS win,
      SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END) AS lose
    FROM daily_stock_results
    WHERE code = ANY($1)
    GROUP BY code
    `,
    [codes]
  );

  for (const row of rows) {
    const code = String(row.code);
    const win = Number(row.win || 0);
    const lose = Number(row.lose || 0);
    const judged = win + lose;
    const winRate = judged === 0 ? 0 : Math.round((win / judged) * 100);

    map.set(code, {
      code,
      win,
      lose,
      winRate,
    });
  }

  return map;
}

export async function getPatternStatsMap(patternKeys: string[]) {
  const map = new Map<string, PatternStats>();
  const uniqueKeys = Array.from(new Set(patternKeys.filter(Boolean)));

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
    const win = Number(row.win || 0);
    const lose = Number(row.lose || 0);

    map.set(patternKey, {
      patternKey,
      win,
      lose,
    });
  }

  return map;
}

export async function getWeightRuleMap(patternKeys: string[]) {
  const map = new Map<string, WeightRule>();
  const uniqueKeys = Array.from(new Set(patternKeys.filter(Boolean)));

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
      bonus: Number(row.bonus || 0),
      winRate: Number(row.win_rate || 0),
      sampleCount: Number(row.sample_count || 0),
      confidence: Number(row.confidence || 0),
    });
  }

  return map;
}

export async function getSectorWeightRuleMap(sectorKeys: string[]) {
  const map = new Map<string, SectorWeightRule>();
  const uniqueKeys = Array.from(new Set(sectorKeys.filter(Boolean)));

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
      bonus: Number(row.bonus || 0),
      winRate: Number(row.win_rate || 0),
      sampleCount: Number(row.sample_count || 0),
      confidence: Number(row.confidence || 0),
    });
  }

  return map;
}

export async function getSectorStatsMap(sectorKeys: string[]) {
  const map = new Map<string, SectorStats>();
  const uniqueKeys = Array.from(new Set(sectorKeys.filter(Boolean)));

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
      win: Number(row.win || 0),
      lose: Number(row.lose || 0),
    });
  }

  return map;
}