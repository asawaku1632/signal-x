import pool from "@/app/lib/postgres";

export type ExperienceSignalInput = {
  patternKey?: string | null;
  rsiBand?: string | null;
  macdKey?: string | null;
  vwapKey?: string | null;
  ema20Key?: string | null;
  trendKey?: string | null;
  minSampleCount?: number;
};

export type ExperienceMatch = {
  ruleKey: string;
  patternKey: string;
  sampleCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  totalCount: number;
  judgedCount: number;
  winRate: number;
  confidence: number;
  experienceBonus: number;
  label: string;
  reason: string;
};

export type ExperienceReport = {
  success: boolean;
  debugVersion: string;
  checkedAt: string;
  input: {
    patternKey: string | null;
    rsiBand: string | null;
    macdKey: string | null;
    vwapKey: string | null;
    ema20Key: string | null;
    trendKey: string | null;
    minSampleCount: number;
  };
  match: ExperienceMatch | null;
  candidates: ExperienceMatch[];
  nextAction: string;
};

const DEBUG_VERSION = "V23_1_EXPERIENCE_AI_WIN_LOSE_RATE_0707";

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function safeMinSampleCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 3;
  if ((value as number) < 1) return 3;
  if ((value as number) > 100) return 100;
  return Math.floor(value as number);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildPatternKey(input: ExperienceSignalInput): string | null {
  const explicitPatternKey = normalizeText(input.patternKey);
  if (explicitPatternKey) return explicitPatternKey;

  const parts = [
    normalizeText(input.rsiBand),
    normalizeText(input.macdKey),
    normalizeText(input.vwapKey),
    normalizeText(input.ema20Key),
    normalizeText(input.trendKey),
  ];

  if (parts.some((part) => !part)) return null;

  return parts.join("|");
}

function buildLabel(winRate: number, sampleCount: number): string {
  if (sampleCount < 3) return "LOW_SAMPLE";
  if (winRate >= 80) return "STRONG_EXPERIENCE";
  if (winRate >= 65) return "GOOD_EXPERIENCE";
  if (winRate >= 50) return "NEUTRAL_EXPERIENCE";
  return "WEAK_EXPERIENCE";
}

function buildExperienceBonus(winRate: number, sampleCount: number): number {
  if (sampleCount < 3) return 0;

  if (winRate >= 90 && sampleCount >= 30) return 18;
  if (winRate >= 85 && sampleCount >= 20) return 15;
  if (winRate >= 80 && sampleCount >= 10) return 12;
  if (winRate >= 75 && sampleCount >= 5) return 10;
  if (winRate >= 65 && sampleCount >= 3) return 6;
  if (winRate >= 50) return 0;
  if (winRate >= 35) return -5;
  return -10;
}

function buildConfidence(sampleCount: number): number {
  if (sampleCount >= 50) return 80;
  if (sampleCount >= 30) return 60;
  if (sampleCount >= 10) return 40;
  if (sampleCount >= 5) return 20;
  if (sampleCount >= 3) return 10;
  return 0;
}

function buildReason(input: {
  sampleCount: number;
  holdCount: number;
  winRate: number;
  experienceBonus: number;
  label: string;
}): string {
  if (input.sampleCount < 3) {
    return `勝敗が確定した似た経験が${input.sampleCount}件のため、経験ボーナスは付与しません。HOLD ${input.holdCount}件は参考値です。`;
  }

  if (input.experienceBonus > 0) {
    return `勝敗確定の似た経験 ${input.sampleCount}件で勝率${input.winRate}%。HOLD ${input.holdCount}件は参考値。${input.label}として+${input.experienceBonus}点補正します。`;
  }

  if (input.experienceBonus < 0) {
    return `勝敗確定の似た経験 ${input.sampleCount}件で勝率${input.winRate}%。HOLD ${input.holdCount}件は参考値。弱い経験として${input.experienceBonus}点補正します。`;
  }

  return `勝敗確定の似た経験 ${input.sampleCount}件で勝率${input.winRate}%。HOLD ${input.holdCount}件は参考値。中立経験として補正なし。`;
}

function mapRowToExperience(row: any): ExperienceMatch {
  const winCount = Number(row.win_count ?? 0);
  const loseCount = Number(row.lose_count ?? 0);
  const holdCount = Number(row.hold_count ?? 0);

  // V23.1:
  // sampleCount / winRate は WIN + LOSE の勝敗確定データだけで計算する。
  // HOLD はまだ勝敗が確定していない参考データとして別管理する。
  const sampleCount = winCount + loseCount;
  const totalCount = winCount + loseCount + holdCount;
  const judgedCount = sampleCount;

  const winRate = sampleCount > 0 ? round1((winCount / sampleCount) * 100) : 0;
  const confidence = buildConfidence(sampleCount);
  const experienceBonus = buildExperienceBonus(winRate, sampleCount);
  const patternKey = String(row.pattern_key);
  const label = buildLabel(winRate, sampleCount);

  return {
    ruleKey: patternKey,
    patternKey,
    sampleCount,
    winCount,
    loseCount,
    holdCount,
    totalCount,
    judgedCount,
    winRate,
    confidence,
    experienceBonus,
    label,
    reason: buildReason({
      sampleCount,
      holdCount,
      winRate,
      experienceBonus,
      label,
    }),
  };
}

async function findExactExperience(
  patternKey: string,
  minSampleCount: number
): Promise<ExperienceMatch | null> {
  const { rows } = await pool.query(
    `
    SELECT
      pattern_key,
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS win_count,
      COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose_count,
      COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold_count
    FROM pattern_learning_logs
    WHERE
      pattern_key = $1
      AND judge_status = 'JUDGED'
      AND result IN ('WIN', 'LOSE', 'HOLD')
    GROUP BY pattern_key
    HAVING COUNT(*) FILTER (WHERE result IN ('WIN', 'LOSE')) >= $2
    LIMIT 1
    `,
    [patternKey, minSampleCount]
  );

  if (!rows[0]) return null;
  return mapRowToExperience(rows[0]);
}

async function findCandidateExperiences(
  minSampleCount: number,
  limit = 10
): Promise<ExperienceMatch[]> {
  const { rows } = await pool.query(
    `
    SELECT
      pattern_key,
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS win_count,
      COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose_count,
      COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold_count
    FROM pattern_learning_logs
    WHERE
      judge_status = 'JUDGED'
      AND result IN ('WIN', 'LOSE', 'HOLD')
      AND pattern_key IS NOT NULL
    GROUP BY pattern_key
    HAVING COUNT(*) FILTER (WHERE result IN ('WIN', 'LOSE')) >= $1
    ORDER BY
      COUNT(*) FILTER (WHERE result = 'WIN')::float
        / NULLIF(COUNT(*) FILTER (WHERE result IN ('WIN', 'LOSE')), 0) DESC,
      COUNT(*) FILTER (WHERE result IN ('WIN', 'LOSE')) DESC,
      COUNT(*) DESC
    LIMIT $2
    `,
    [minSampleCount, limit]
  );

  return rows.map(mapRowToExperience);
}

export async function getExperienceReport(
  input: ExperienceSignalInput = {}
): Promise<ExperienceReport> {
  const minSampleCount = safeMinSampleCount(input.minSampleCount);
  const patternKey = buildPatternKey(input);

  const match = patternKey
    ? await findExactExperience(patternKey, minSampleCount)
    : null;

  const candidates = await findCandidateExperiences(minSampleCount, 10);

  return {
    success: true,
    debugVersion: DEBUG_VERSION,
    checkedAt: new Date().toISOString(),
    input: {
      patternKey,
      rsiBand: normalizeText(input.rsiBand),
      macdKey: normalizeText(input.macdKey),
      vwapKey: normalizeText(input.vwapKey),
      ema20Key: normalizeText(input.ema20Key),
      trendKey: normalizeText(input.trendKey),
      minSampleCount,
    },
    match,
    candidates,
    nextAction: match
      ? "このexperienceBonusをAI POWER計算へ接続します。"
      : "勝敗確定サンプルが少ないため、候補一覧から高勝率パターンを確認してください。",
  };
}
