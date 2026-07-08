import pool from "@/app/lib/postgres";

export type WeightOptimizeMode = "preview" | "execute";

export type WeightOptimizeGrade = "S" | "A" | "B" | "C" | "D" | "LOW_SAMPLE";

export type WeightOptimizationDecision = {
  id: number;
  ruleKey: string;
  ruleType: string;
  currentBonus: number;
  recommendedBonus: number;
  currentConfidence: number;
  recommendedConfidence: number;
  winRate: number;
  sampleCount: number;
  winCount: number;
  loseCount: number;
  grade: WeightOptimizeGrade;
  optimized: boolean;
  changed: boolean;
  reason: string;
};

export type WeightOptimizationReport = {
  success: boolean;
  debugVersion: string;
  checkedAt: string;
  mode: WeightOptimizeMode;
  minSampleCount: number;
  targetCount: number;
  optimizedCount: number;
  changedCount: number;
  decisions: WeightOptimizationDecision[];
  nextAction: string;
};

const DEBUG_VERSION = "V24_1_WEIGHT_OPTIMIZER_0707";

function normalizeMode(value: string | null | undefined): WeightOptimizeMode {
  return value === "execute" ? "execute" : "preview";
}

function safeLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 100;
  if ((value as number) < 1) return 100;
  if ((value as number) > 500) return 500;
  return Math.floor(value as number);
}

function safeMinSampleCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 3;
  if ((value as number) < 1) return 3;
  if ((value as number) > 100) return 100;
  return Math.floor(value as number);
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function decideGrade(winRate: number, sampleCount: number): WeightOptimizeGrade {
  if (sampleCount < 3) return "LOW_SAMPLE";
  if (winRate >= 90) return "S";
  if (winRate >= 80) return "A";
  if (winRate >= 65) return "B";
  if (winRate >= 50) return "C";
  return "D";
}

function decideBonus(winRate: number, sampleCount: number): number {
  if (sampleCount < 3) return 0;

  if (winRate >= 95 && sampleCount >= 50) return 18;
  if (winRate >= 90 && sampleCount >= 30) return 15;
  if (winRate >= 85 && sampleCount >= 20) return 12;
  if (winRate >= 80 && sampleCount >= 10) return 10;
  if (winRate >= 75 && sampleCount >= 5) return 8;
  if (winRate >= 65 && sampleCount >= 3) return 5;
  if (winRate >= 50) return 0;
  if (winRate >= 40) return -3;
  if (winRate >= 30) return -5;
  return -10;
}

function decideConfidence(sampleCount: number): number {
  if (sampleCount >= 100) return 100;
  if (sampleCount >= 50) return 80;
  if (sampleCount >= 30) return 60;
  if (sampleCount >= 10) return 40;
  if (sampleCount >= 5) return 20;
  if (sampleCount >= 3) return 10;
  return 0;
}

function buildReason(input: {
  ruleKey: string;
  winRate: number;
  sampleCount: number;
  currentBonus: number;
  recommendedBonus: number;
  currentConfidence: number;
  recommendedConfidence: number;
  grade: WeightOptimizeGrade;
}) {
  if (input.grade === "LOW_SAMPLE") {
    return `sampleCount ${input.sampleCount}件のため、自己進化対象外。`;
  }

  const bonusText =
    input.currentBonus === input.recommendedBonus
      ? `bonus ${input.currentBonus}を維持`
      : `bonus ${input.currentBonus} → ${input.recommendedBonus}`;

  const confidenceText =
    input.currentConfidence === input.recommendedConfidence
      ? `confidence ${input.currentConfidence}を維持`
      : `confidence ${input.currentConfidence} → ${input.recommendedConfidence}`;

  return `勝率${input.winRate}% / sample ${input.sampleCount}件 / grade ${input.grade}。${bonusText}、${confidenceText}。`;
}

async function fetchWeightRules(limit: number, minSampleCount: number) {
  const { rows } = await pool.query(
    `
    SELECT
      id,
      rule_key,
      rule_type,
      bonus,
      win_rate,
      sample_count,
      win_count,
      lose_count,
      confidence
    FROM ai_power_weight_rules
    WHERE
      is_active = true
      AND sample_count >= $1
    ORDER BY sample_count DESC, win_rate DESC, id ASC
    LIMIT $2
    `,
    [minSampleCount, limit]
  );

  return rows;
}

async function updateWeightRule(decision: WeightOptimizationDecision) {
  await pool.query(
    `
    UPDATE ai_power_weight_rules
    SET
      bonus = $1,
      confidence = $2,
      updated_at = NOW()
    WHERE id = $3
    `,
    [decision.recommendedBonus, decision.recommendedConfidence, decision.id]
  );
}

export async function optimizeWeightRules(options?: {
  mode?: string | null;
  limit?: number;
  minSampleCount?: number;
}): Promise<WeightOptimizationReport> {
  const mode = normalizeMode(options?.mode);
  const limit = safeLimit(options?.limit);
  const minSampleCount = safeMinSampleCount(options?.minSampleCount);

  const rows = await fetchWeightRules(limit, minSampleCount);

  const decisions: WeightOptimizationDecision[] = rows.map((row: any) => {
    const sampleCount = toNumber(row.sample_count);
    const winCount = toNumber(row.win_count);
    const loseCount = toNumber(row.lose_count);
    const storedWinRate = toNumber(row.win_rate);
    const calculatedWinRate =
      sampleCount > 0 ? round1((winCount / sampleCount) * 100) : storedWinRate;
    const winRate = storedWinRate > 0 ? round1(storedWinRate) : calculatedWinRate;

    const currentBonus = toNumber(row.bonus);
    const currentConfidence = toNumber(row.confidence);
    const grade = decideGrade(winRate, sampleCount);
    const recommendedBonus = decideBonus(winRate, sampleCount);
    const recommendedConfidence = decideConfidence(sampleCount);
    const changed =
      currentBonus !== recommendedBonus ||
      currentConfidence !== recommendedConfidence;

    return {
      id: toNumber(row.id),
      ruleKey: String(row.rule_key),
      ruleType: String(row.rule_type ?? "pattern"),
      currentBonus,
      recommendedBonus,
      currentConfidence,
      recommendedConfidence,
      winRate,
      sampleCount,
      winCount,
      loseCount,
      grade,
      optimized: false,
      changed,
      reason: buildReason({
        ruleKey: String(row.rule_key),
        winRate,
        sampleCount,
        currentBonus,
        recommendedBonus,
        currentConfidence,
        recommendedConfidence,
        grade,
      }),
    };
  });

  if (mode === "execute") {
    for (const decision of decisions) {
      if (!decision.changed) continue;
      await updateWeightRule(decision);
      decision.optimized = true;
    }
  }

  return {
    success: true,
    debugVersion: DEBUG_VERSION,
    checkedAt: new Date().toISOString(),
    mode,
    minSampleCount,
    targetCount: decisions.length,
    optimizedCount: decisions.filter((decision) => decision.optimized).length,
    changedCount: decisions.filter((decision) => decision.changed).length,
    decisions,
    nextAction:
      mode === "preview"
        ? "内容を確認し、問題なければ mode=execute で重みを自己最適化してください。"
        : "learning quality と /api/scan でAI POWERへの反映を確認してください。",
  };
}
