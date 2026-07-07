import pool from "@/app/lib/postgres";

export type AccuracyEvaluateMode = "preview" | "execute";

export type AiPowerBandKey =
  | "S_85_100"
  | "A_70_84"
  | "B_50_69"
  | "C_0_49"
  | "UNKNOWN";

export type AccuracyBandDecision = {
  bandKey: AiPowerBandKey;
  label: string;
  minScore: number;
  maxScore: number;
  totalCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  judgedCount: number;
  winRate: number;
  precisionRate: number;
  grade: "EXCELLENT" | "GOOD" | "NORMAL" | "WEAK" | "LOW_SAMPLE";
  recommendedAction: "BOOST" | "KEEP" | "REDUCE" | "WATCH";
  reason: string;
};

export type AccuracyEvaluationReport = {
  success: boolean;
  debugVersion: string;
  checkedAt: string;
  mode: AccuracyEvaluateMode;
  scoreColumn: string;
  minJudgedCount: number;
  targetCount: number;
  overall: {
    totalCount: number;
    winCount: number;
    loseCount: number;
    holdCount: number;
    judgedCount: number;
    winRate: number;
  };
  bands: AccuracyBandDecision[];
  summary: {
    excellentCount: number;
    goodCount: number;
    weakCount: number;
    lowSampleCount: number;
    boostCount: number;
    reduceCount: number;
    watchCount: number;
  };
  nextAction: string;
};

const DEBUG_VERSION = "V24_2_AI_POWER_ACCURACY_EVALUATOR_FIX_0707";

const SCORE_COLUMN_CANDIDATES = [
  "ai_power",
  "score",
  "final_score",
  "ai_score",
  "power_score",
];

function normalizeMode(value: string | null | undefined): AccuracyEvaluateMode {
  return value === "execute" ? "execute" : "preview";
}

function safeMinJudgedCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 5;
  if ((value as number) < 1) return 5;
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

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function resolveScoreColumn(): Promise<string> {
  const { rows } = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'daily_stock_results'
    `
  );

  const columnSet = new Set(rows.map((row: any) => String(row.column_name)));

  const matched = SCORE_COLUMN_CANDIDATES.find((columnName) =>
    columnSet.has(columnName)
  );

  if (!matched) {
    throw new Error(
      `daily_stock_results にAI POWER/score系カラムが見つかりません。候補: ${SCORE_COLUMN_CANDIDATES.join(
        ", "
      )}`
    );
  }

  return matched;
}

function bandMeta(bandKey: AiPowerBandKey) {
  switch (bandKey) {
    case "S_85_100":
      return { label: "Sランク / 激熱", minScore: 85, maxScore: 100 };
    case "A_70_84":
      return { label: "Aランク / 強い", minScore: 70, maxScore: 84 };
    case "B_50_69":
      return { label: "Bランク / 様子見", minScore: 50, maxScore: 69 };
    case "C_0_49":
      return { label: "Cランク / 見送り", minScore: 0, maxScore: 49 };
    default:
      return { label: "UNKNOWN", minScore: 0, maxScore: 0 };
  }
}

function gradeAccuracy(
  bandKey: AiPowerBandKey,
  winRate: number,
  judgedCount: number,
  minJudgedCount: number
): AccuracyBandDecision["grade"] {
  if (judgedCount < minJudgedCount) return "LOW_SAMPLE";

  if (bandKey === "S_85_100") {
    if (winRate >= 75) return "EXCELLENT";
    if (winRate >= 65) return "GOOD";
    if (winRate >= 50) return "NORMAL";
    return "WEAK";
  }

  if (bandKey === "A_70_84") {
    if (winRate >= 70) return "EXCELLENT";
    if (winRate >= 60) return "GOOD";
    if (winRate >= 45) return "NORMAL";
    return "WEAK";
  }

  if (bandKey === "B_50_69") {
    if (winRate >= 60) return "GOOD";
    if (winRate >= 45) return "NORMAL";
    return "WEAK";
  }

  if (bandKey === "C_0_49") {
    if (winRate <= 25) return "EXCELLENT";
    if (winRate <= 40) return "GOOD";
    if (winRate <= 55) return "NORMAL";
    return "WEAK";
  }

  return "LOW_SAMPLE";
}

function recommendedAction(
  bandKey: AiPowerBandKey,
  grade: AccuracyBandDecision["grade"]
): AccuracyBandDecision["recommendedAction"] {
  if (grade === "LOW_SAMPLE") return "WATCH";

  if (bandKey === "S_85_100" || bandKey === "A_70_84") {
    if (grade === "EXCELLENT" || grade === "GOOD") return "BOOST";
    if (grade === "WEAK") return "REDUCE";
    return "KEEP";
  }

  if (bandKey === "B_50_69") {
    if (grade === "GOOD") return "BOOST";
    if (grade === "WEAK") return "REDUCE";
    return "KEEP";
  }

  if (bandKey === "C_0_49") {
    if (grade === "EXCELLENT" || grade === "GOOD") return "KEEP";
    if (grade === "WEAK") return "REDUCE";
    return "WATCH";
  }

  return "WATCH";
}

function buildReason(input: {
  label: string;
  winRate: number;
  judgedCount: number;
  grade: AccuracyBandDecision["grade"];
  action: AccuracyBandDecision["recommendedAction"];
}) {
  if (input.grade === "LOW_SAMPLE") {
    return `${input.label}は勝敗確定サンプルが${input.judgedCount}件のため、まだ監視のみ。`;
  }

  if (input.action === "BOOST") {
    return `${input.label}は勝率${input.winRate}%で${input.grade}。現在のAI POWER判断は良好。関連重みは強める候補。`;
  }

  if (input.action === "REDUCE") {
    return `${input.label}は勝率${input.winRate}%で${input.grade}。AI POWERが強く出すぎている可能性。関連重みは弱める候補。`;
  }

  if (input.action === "KEEP") {
    return `${input.label}は勝率${input.winRate}%で${input.grade}。現状維持。`;
  }

  return `${input.label}は勝率${input.winRate}%で${input.grade}。継続監視。`;
}

function mapBandRow(row: any, minJudgedCount: number): AccuracyBandDecision {
  const bandKey = String(row.band_key ?? "UNKNOWN") as AiPowerBandKey;
  const meta = bandMeta(bandKey);

  const totalCount = toNumber(row.total_count);
  const winCount = toNumber(row.win_count);
  const loseCount = toNumber(row.lose_count);
  const holdCount = toNumber(row.hold_count);
  const judgedCount = winCount + loseCount;
  const winRate = judgedCount > 0 ? round1((winCount / judgedCount) * 100) : 0;
  const precisionRate =
    totalCount > 0 ? round1(((winCount + holdCount) / totalCount) * 100) : 0;

  const grade = gradeAccuracy(bandKey, winRate, judgedCount, minJudgedCount);
  const action = recommendedAction(bandKey, grade);

  return {
    bandKey,
    label: meta.label,
    minScore: meta.minScore,
    maxScore: meta.maxScore,
    totalCount,
    winCount,
    loseCount,
    holdCount,
    judgedCount,
    winRate,
    precisionRate,
    grade,
    recommendedAction: action,
    reason: buildReason({
      label: meta.label,
      winRate,
      judgedCount,
      grade,
      action,
    }),
  };
}

async function fetchAccuracyBands(
  scoreColumn: string,
  minJudgedCount: number
): Promise<AccuracyBandDecision[]> {
  const scoreSql = quoteIdentifier(scoreColumn);

  const { rows } = await pool.query(
    `
    WITH source AS (
      SELECT
        CASE
          WHEN ${scoreSql} >= 85 THEN 'S_85_100'
          WHEN ${scoreSql} >= 70 THEN 'A_70_84'
          WHEN ${scoreSql} >= 50 THEN 'B_50_69'
          WHEN ${scoreSql} >= 0 THEN 'C_0_49'
          ELSE 'UNKNOWN'
        END AS band_key,
        result
      FROM daily_stock_results
      WHERE
        ${scoreSql} IS NOT NULL
        AND result IN ('WIN', 'LOSE', 'HOLD')
    )
    SELECT
      band_key,
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS win_count,
      COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose_count,
      COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold_count
    FROM source
    GROUP BY band_key
    ORDER BY
      CASE band_key
        WHEN 'S_85_100' THEN 1
        WHEN 'A_70_84' THEN 2
        WHEN 'B_50_69' THEN 3
        WHEN 'C_0_49' THEN 4
        ELSE 5
      END
    `
  );

  return rows.map((row: any) => mapBandRow(row, minJudgedCount));
}

async function fetchOverall(scoreColumn: string) {
  const scoreSql = quoteIdentifier(scoreColumn);

  const { rows } = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS win_count,
      COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose_count,
      COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold_count
    FROM daily_stock_results
    WHERE
      ${scoreSql} IS NOT NULL
      AND result IN ('WIN', 'LOSE', 'HOLD')
    `
  );

  const row = rows[0] ?? {};
  const winCount = toNumber(row.win_count);
  const loseCount = toNumber(row.lose_count);
  const judgedCount = winCount + loseCount;

  return {
    totalCount: toNumber(row.total_count),
    winCount,
    loseCount,
    holdCount: toNumber(row.hold_count),
    judgedCount,
    winRate: judgedCount > 0 ? round1((winCount / judgedCount) * 100) : 0,
  };
}

export async function evaluateAiPowerAccuracy(options?: {
  mode?: string | null;
  minJudgedCount?: number;
}): Promise<AccuracyEvaluationReport> {
  const mode = normalizeMode(options?.mode);
  const minJudgedCount = safeMinJudgedCount(options?.minJudgedCount);
  const scoreColumn = await resolveScoreColumn();

  const [overall, bands] = await Promise.all([
    fetchOverall(scoreColumn),
    fetchAccuracyBands(scoreColumn, minJudgedCount),
  ]);

  return {
    success: true,
    debugVersion: DEBUG_VERSION,
    checkedAt: new Date().toISOString(),
    mode,
    scoreColumn,
    minJudgedCount,
    targetCount: bands.length,
    overall,
    bands,
    summary: {
      excellentCount: bands.filter((band) => band.grade === "EXCELLENT").length,
      goodCount: bands.filter((band) => band.grade === "GOOD").length,
      weakCount: bands.filter((band) => band.grade === "WEAK").length,
      lowSampleCount: bands.filter((band) => band.grade === "LOW_SAMPLE").length,
      boostCount: bands.filter((band) => band.recommendedAction === "BOOST").length,
      reduceCount: bands.filter((band) => band.recommendedAction === "REDUCE").length,
      watchCount: bands.filter((band) => band.recommendedAction === "WATCH").length,
    },
    nextAction:
      mode === "preview"
        ? "AI POWER帯ごとの予測精度を確認し、弱い帯があればWeight Optimizerの閾値調整へ進んでください。"
        : "この評価を進化ログへ保存し、毎日の自己進化ループへ接続します。",
  };
}
