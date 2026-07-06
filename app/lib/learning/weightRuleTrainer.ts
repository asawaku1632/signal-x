import pool from "@/app/lib/postgres";

export type WeightRuleTrainingResult = {
  ruleType: "pattern";
  targetCount: number;
  upsertedCount: number;
  minSampleCount: number;
  rules: {
    ruleKey: string;
    bonus: number;
    winRate: number;
    sampleCount: number;
    winCount: number;
    loseCount: number;
    confidence: number;
  }[];
};

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function calcBonus(winRate: number, sampleCount: number): number {
  if (sampleCount < 3) return 0;

  if (winRate >= 75) return 10;
  if (winRate >= 65) return 6;
  if (winRate >= 55) return 3;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -3;

  return -6;
}

function calcConfidence(sampleCount: number): number {
  if (sampleCount >= 100) return 100;
  if (sampleCount >= 50) return 80;
  if (sampleCount >= 30) return 65;
  if (sampleCount >= 10) return 40;
  if (sampleCount >= 3) return 20;

  return 0;
}

export async function trainPatternWeightRules(options?: {
  minSampleCount?: number;
}): Promise<WeightRuleTrainingResult> {
  const minSampleCount = options?.minSampleCount ?? 3;

  const { rows } = await pool.query(
    `
    SELECT
      pattern_key,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS win_count,
      SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END) AS lose_count
    FROM pattern_learning_logs
    WHERE
      pattern_key IS NOT NULL
      AND result IN ('WIN', 'LOSE')
    GROUP BY pattern_key
    HAVING
      (
        SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END)
        +
        SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END)
      ) >= $1
    ORDER BY pattern_key
    `,
    [minSampleCount]
  );

  const rules = rows.map((row: any) => {
    const winCount = toNumber(row.win_count);
    const loseCount = toNumber(row.lose_count);
    const sampleCount = winCount + loseCount;
    const winRate =
      sampleCount > 0 ? Math.round((winCount / sampleCount) * 100) : 0;

    return {
      ruleKey: String(row.pattern_key),
      bonus: calcBonus(winRate, sampleCount),
      winRate,
      sampleCount,
      winCount,
      loseCount,
      confidence: calcConfidence(sampleCount),
    };
  });

  for (const rule of rules) {
    await pool.query(
      `
      INSERT INTO ai_power_weight_rules (
        rule_type,
        rule_key,
        bonus,
        win_rate,
        sample_count,
        win_count,
        lose_count,
        confidence,
        is_active,
        updated_at,
        created_at
      )
      VALUES (
        'pattern',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (rule_type, rule_key)
      DO UPDATE SET
        bonus = EXCLUDED.bonus,
        win_rate = EXCLUDED.win_rate,
        sample_count = EXCLUDED.sample_count,
        win_count = EXCLUDED.win_count,
        lose_count = EXCLUDED.lose_count,
        confidence = EXCLUDED.confidence,
        is_active = true,
        updated_at = NOW()
      `,
      [
        rule.ruleKey,
        rule.bonus,
        rule.winRate,
        rule.sampleCount,
        rule.winCount,
        rule.loseCount,
        rule.confidence,
      ]
    );
  }

  return {
    ruleType: "pattern",
    targetCount: rules.length,
    upsertedCount: rules.length,
    minSampleCount,
    rules,
  };
}
