export type LearningJudgement = "WIN" | "LOSE" | "HOLD" | "UNKNOWN";

export type LearningRecord = {
  code?: string;
  name?: string;
  date?: string;
  score?: number;
  aiPower?: number;
  price?: number;
  entryPrice?: number;
  currentPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  result?: LearningJudgement | string;
  judgement?: LearningJudgement | string;
  judgedAt?: string;
  patternKey?: string;
  sectorKey?: string;
  marketPattern?: string;
  reason?: string;
  [key: string]: any;
};

export type LearningValidationIssueLevel = "ERROR" | "WARN" | "INFO";

export type LearningValidationIssue = {
  level: LearningValidationIssueLevel;
  code: string;
  message: string;
  stockCode?: string;
  field?: string;
};

export type LearningValidationSummary = {
  checkedCount: number;
  validCount: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  unknownCount: number;
  winRate: number;
  dataQualityScore: number;
  issues: LearningValidationIssue[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeJudgement(record: LearningRecord): LearningJudgement {
  const raw = String(record.result ?? record.judgement ?? "UNKNOWN").toUpperCase();

  if (raw === "WIN") return "WIN";
  if (raw === "LOSE") return "LOSE";
  if (raw === "HOLD") return "HOLD";

  return "UNKNOWN";
}

function addIssue(
  issues: LearningValidationIssue[],
  issue: LearningValidationIssue
) {
  issues.push(issue);
}

export function validateLearningRecords(
  records: LearningRecord[]
): LearningValidationSummary {
  const issues: LearningValidationIssue[] = [];

  let validCount = 0;
  let winCount = 0;
  let loseCount = 0;
  let holdCount = 0;
  let unknownCount = 0;

  for (const record of records) {
    let hasError = false;
    const stockCode = record.code;

    if (!record.code || typeof record.code !== "string") {
      hasError = true;
      addIssue(issues, {
        level: "ERROR",
        code: "MISSING_STOCK_CODE",
        message: "銘柄コードがありません。",
        field: "code",
      });
    }

    if (!record.date || typeof record.date !== "string") {
      hasError = true;
      addIssue(issues, {
        level: "ERROR",
        code: "MISSING_DATE",
        message: "学習対象日がありません。",
        stockCode,
        field: "date",
      });
    }

    const score = record.score ?? record.aiPower;
    if (!isFiniteNumber(score)) {
      hasError = true;
      addIssue(issues, {
        level: "ERROR",
        code: "MISSING_SCORE",
        message: "AIスコアがありません。",
        stockCode,
        field: "score",
      });
    } else if (score < 0 || score > 100) {
      hasError = true;
      addIssue(issues, {
        level: "ERROR",
        code: "INVALID_SCORE_RANGE",
        message: "AIスコアが0〜100の範囲外です。",
        stockCode,
        field: "score",
      });
    }

    const entryPrice = record.entryPrice ?? record.price;
    if (!isFiniteNumber(entryPrice) || entryPrice <= 0) {
      hasError = true;
      addIssue(issues, {
        level: "ERROR",
        code: "INVALID_ENTRY_PRICE",
        message: "基準価格が不正です。",
        stockCode,
        field: "entryPrice",
      });
    }

    if (
      record.takeProfit !== undefined &&
      (!isFiniteNumber(record.takeProfit) || record.takeProfit <= 0)
    ) {
      hasError = true;
      addIssue(issues, {
        level: "ERROR",
        code: "INVALID_TAKE_PROFIT",
        message: "利確価格が不正です。",
        stockCode,
        field: "takeProfit",
      });
    }

    if (
      record.stopLoss !== undefined &&
      (!isFiniteNumber(record.stopLoss) || record.stopLoss <= 0)
    ) {
      hasError = true;
      addIssue(issues, {
        level: "ERROR",
        code: "INVALID_STOP_LOSS",
        message: "損切価格が不正です。",
        stockCode,
        field: "stopLoss",
      });
    }

    if (
      isFiniteNumber(record.takeProfit) &&
      isFiniteNumber(entryPrice) &&
      record.takeProfit <= entryPrice
    ) {
      addIssue(issues, {
        level: "WARN",
        code: "TAKE_PROFIT_NOT_ABOVE_ENTRY",
        message: "利確価格が基準価格以下です。",
        stockCode,
        field: "takeProfit",
      });
    }

    if (
      isFiniteNumber(record.stopLoss) &&
      isFiniteNumber(entryPrice) &&
      record.stopLoss >= entryPrice
    ) {
      addIssue(issues, {
        level: "WARN",
        code: "STOP_LOSS_NOT_BELOW_ENTRY",
        message: "損切価格が基準価格以上です。",
        stockCode,
        field: "stopLoss",
      });
    }

    if (!record.patternKey) {
      addIssue(issues, {
        level: "INFO",
        code: "MISSING_PATTERN_KEY",
        message: "patternKeyがありません。パターン別学習精度が弱くなります。",
        stockCode,
        field: "patternKey",
      });
    }

    if (!record.sectorKey) {
      addIssue(issues, {
        level: "INFO",
        code: "MISSING_SECTOR_KEY",
        message: "sectorKeyがありません。セクター別学習精度が弱くなります。",
        stockCode,
        field: "sectorKey",
      });
    }

    const judgement = normalizeJudgement(record);
    if (judgement === "WIN") winCount += 1;
    if (judgement === "LOSE") loseCount += 1;
    if (judgement === "HOLD") holdCount += 1;
    if (judgement === "UNKNOWN") unknownCount += 1;

    if (judgement === "UNKNOWN") {
      addIssue(issues, {
        level: "INFO",
        code: "UNJUDGED_RECORD",
        message: "まだ勝敗判定されていない学習データです。",
        stockCode,
        field: "result",
      });
    }

    if (!hasError) {
      validCount += 1;
    }
  }

  const errorCount = issues.filter((issue) => issue.level === "ERROR").length;
  const warnCount = issues.filter((issue) => issue.level === "WARN").length;
  const infoCount = issues.filter((issue) => issue.level === "INFO").length;

  const judgedCount = winCount + loseCount;
  const winRate = judgedCount > 0 ? Math.round((winCount / judgedCount) * 1000) / 10 : 0;

  const checkedCount = records.length;
  const errorPenalty = Math.min(60, errorCount * 8);
  const warnPenalty = Math.min(25, warnCount * 3);
  const unknownPenalty =
    checkedCount > 0 ? Math.min(15, Math.round((unknownCount / checkedCount) * 15)) : 0;

  const dataQualityScore = Math.max(
    0,
    Math.min(100, 100 - errorPenalty - warnPenalty - unknownPenalty)
  );

  return {
    checkedCount,
    validCount,
    errorCount,
    warnCount,
    infoCount,
    winCount,
    loseCount,
    holdCount,
    unknownCount,
    winRate,
    dataQualityScore,
    issues,
  };
}

export function buildLearningQualityLabel(score: number) {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "CAUTION";
  return "NEEDS_REVIEW";
}
