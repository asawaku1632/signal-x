import pool from "@/app/lib/postgres";

export type PatternJudgeMode = "preview" | "execute";
export type PatternJudgeResult = "WIN" | "LOSE" | "HOLD" | "UNKNOWN";
export type PatternJudgeStatus = "PENDING" | "JUDGED" | "ERROR";

const JUDGE_VERSION = "V21.5_PATTERN_JUDGE_SKIP_JUDGED_0706";

export type PatternJudgeTarget = {
  id: number;
  code: string;
  name?: string;
  patternKey: string;
  currentResult?: string;
  aiPower?: number;
  entryPrice: number;
  createdAt?: string;
  judgeStatus?: string;
};

export type PatternJudgeDecision = {
  id: number;
  code: string;
  name?: string;
  patternKey: string;
  entryPrice: number;
  judgedPrice?: number;
  currentResult?: string;
  suggestedResult: PatternJudgeResult;
  judgeStatus: PatternJudgeStatus;
  judgementReason: string;
  judgeVersion: string;
  updated: boolean;
};

export type PatternJudgeReport = {
  checkedAt: string;
  mode: PatternJudgeMode;
  limit: number;
  targetCount: number;
  processedCount: number;
  updatedCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  unknownCount: number;
  errorCount: number;
  decisions: PatternJudgeDecision[];
};

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeMode(value: string | null): PatternJudgeMode {
  return value === "execute" ? "execute" : "preview";
}

function safeLimit(value: number) {
  if (!Number.isFinite(value)) return 20;
  if (value < 1) return 20;
  if (value > 200) return 200;
  return Math.floor(value);
}

function toDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function fetchYahooPrice(code: string): Promise<number | null> {
  const symbol = `${code}.T`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=5d&interval=1d`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 SIGNALX/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const closes = quote?.close;

    if (!Array.isArray(closes)) return null;

    const latestClose = [...closes]
      .reverse()
      .find((value) => typeof value === "number" && Number.isFinite(value));

    return typeof latestClose === "number" ? latestClose : null;
  } catch {
    return null;
  }
}

function judgePatternResult(entryPrice: number, judgedPrice: number | null): {
  result: PatternJudgeResult;
  status: PatternJudgeStatus;
  reason: string;
} {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return {
      result: "UNKNOWN",
      status: "ERROR",
      reason: "entry_priceが不正なため判定できません。",
    };
  }

  if (!judgedPrice || !Number.isFinite(judgedPrice) || judgedPrice <= 0) {
    return {
      result: "UNKNOWN",
      status: "ERROR",
      reason: "判定価格を取得できませんでした。",
    };
  }

  const changeRate = ((judgedPrice - entryPrice) / entryPrice) * 100;
  const roundedRate = Math.round(changeRate * 100) / 100;

  if (changeRate >= 3) {
    return {
      result: "WIN",
      status: "JUDGED",
      reason: `entry_priceから${roundedRate}%上昇したためWIN判定。`,
    };
  }

  if (changeRate <= -2) {
    return {
      result: "LOSE",
      status: "JUDGED",
      reason: `entry_priceから${roundedRate}%下落したためLOSE判定。`,
    };
  }

  return {
    result: "HOLD",
    status: "JUDGED",
    reason: `entry_priceから${roundedRate}%の変動。閾値内のためHOLD判定。`,
  };
}

async function getTargets(limit: number): Promise<PatternJudgeTarget[]> {
  const { rows } = await pool.query(
    `
    SELECT
      id,
      code,
      name,
      pattern_key,
      result,
      ai_power,
      entry_price,
      created_at,
      judge_status
    FROM pattern_learning_logs
    WHERE
      code IS NOT NULL
      AND entry_price IS NOT NULL
      AND (
        judge_status IS NULL
        OR judge_status = 'PENDING'
        OR judge_status = 'ERROR'
      )
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT $1
    `,
    [limit]
  );

  return rows.map((row: any) => ({
    id: toNumber(row.id),
    code: String(row.code),
    name: row.name ? String(row.name) : undefined,
    patternKey: String(row.pattern_key),
    currentResult: row.result ? String(row.result) : undefined,
    aiPower: row.ai_power !== null ? toNumber(row.ai_power) : undefined,
    entryPrice: toNumber(row.entry_price),
    createdAt: toDateString(row.created_at),
    judgeStatus: row.judge_status ? String(row.judge_status) : undefined,
  }));
}

async function updatePatternJudgement(decision: PatternJudgeDecision) {
  await pool.query(
    `
    UPDATE pattern_learning_logs
    SET
      result = $1,
      judged_price = $2,
      judged_at = NOW(),
      judgement_reason = $3,
      judge_status = $4,
      judge_version = $5
    WHERE id = $6
    `,
    [
      decision.suggestedResult,
      decision.judgedPrice ?? null,
      decision.judgementReason,
      decision.judgeStatus,
      decision.judgeVersion,
      decision.id,
    ]
  );
}

export async function runPatternJudge(options?: {
  mode?: string | null;
  limit?: number;
}): Promise<PatternJudgeReport> {
  const mode = normalizeMode(options?.mode ?? "preview");
  const limit = safeLimit(options?.limit ?? 20);

  const targets = await getTargets(limit);
  const decisions: PatternJudgeDecision[] = [];

  for (const target of targets) {
    const judgedPrice = await fetchYahooPrice(target.code);
    const judgement = judgePatternResult(target.entryPrice, judgedPrice);

    const decision: PatternJudgeDecision = {
      id: target.id,
      code: target.code,
      name: target.name,
      patternKey: target.patternKey,
      entryPrice: target.entryPrice,
      judgedPrice: judgedPrice ?? undefined,
      currentResult: target.currentResult,
      suggestedResult: judgement.result,
      judgeStatus: judgement.status,
      judgementReason: judgement.reason,
      judgeVersion: JUDGE_VERSION,
      updated: false,
    };

    if (mode === "execute") {
      await updatePatternJudgement(decision);
      decision.updated = true;
    }

    decisions.push(decision);
  }

  return {
    checkedAt: new Date().toISOString(),
    mode,
    limit,
    targetCount: targets.length,
    processedCount: decisions.length,
    updatedCount: decisions.filter((decision) => decision.updated).length,
    winCount: decisions.filter((decision) => decision.suggestedResult === "WIN").length,
    loseCount: decisions.filter((decision) => decision.suggestedResult === "LOSE").length,
    holdCount: decisions.filter((decision) => decision.suggestedResult === "HOLD").length,
    unknownCount: decisions.filter((decision) => decision.suggestedResult === "UNKNOWN").length,
    errorCount: decisions.filter((decision) => decision.judgeStatus === "ERROR").length,
    decisions,
  };
}
