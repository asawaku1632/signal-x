import pool from "@/app/lib/postgres";

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function calcWinRate(win: number, lose: number): number {
  const judged = win + lose;
  if (judged <= 0) return 0;
  return Math.round((win / judged) * 1000) / 10;
}

export type LearningQualityTableSummary = {
  tableName: string;
  totalCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  unknownCount: number;
  judgedCount: number;
  winRate: number;
};

export type LearningQualityIssue = {
  level: "ERROR" | "WARN" | "INFO";
  tableName: string;
  code: string;
  message: string;
  count?: number;
};

export type LearningQualityReport = {
  checkedAt: string;
  qualityScore: number;
  qualityLabel: "EXCELLENT" | "GOOD" | "CAUTION" | "NEEDS_REVIEW";
  totalRecords: number;
  judgedRecords: number;
  overallWinRate: number;
  tables: LearningQualityTableSummary[];
  issues: LearningQualityIssue[];
};

function buildQualityLabel(
  score: number
): LearningQualityReport["qualityLabel"] {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "CAUTION";
  return "NEEDS_REVIEW";
}

async function summarizeResultTable(
  tableName: "daily_stock_results" | "pattern_learning_logs"
): Promise<LearningQualityTableSummary> {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) AS total_count,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS win_count,
      SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END) AS lose_count,
      SUM(CASE WHEN result = 'HOLD' THEN 1 ELSE 0 END) AS hold_count,
      SUM(CASE WHEN result IS NULL OR result NOT IN ('WIN', 'LOSE', 'HOLD') THEN 1 ELSE 0 END) AS unknown_count
    FROM ${tableName}
  `);

  const row = rows[0] ?? {};
  const winCount = toNumber(row.win_count);
  const loseCount = toNumber(row.lose_count);
  const holdCount = toNumber(row.hold_count);
  const unknownCount = toNumber(row.unknown_count);
  const totalCount = toNumber(row.total_count);
  const judgedCount = winCount + loseCount;

  return {
    tableName,
    totalCount,
    winCount,
    loseCount,
    holdCount,
    unknownCount,
    judgedCount,
    winRate: calcWinRate(winCount, loseCount),
  };
}

async function summarizeSectorLearning(): Promise<LearningQualityTableSummary> {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) AS total_count,
      SUM(COALESCE(win_count, 0)) AS win_count,
      SUM(COALESCE(lose_count, 0)) AS lose_count
    FROM sector_learning_logs
  `);

  const row = rows[0] ?? {};
  const winCount = toNumber(row.win_count);
  const loseCount = toNumber(row.lose_count);
  const totalCount = toNumber(row.total_count);
  const judgedCount = winCount + loseCount;

  return {
    tableName: "sector_learning_logs",
    totalCount,
    winCount,
    loseCount,
    holdCount: 0,
    unknownCount: 0,
    judgedCount,
    winRate: calcWinRate(winCount, loseCount),
  };
}

async function getWeightRuleCount(): Promise<number> {
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS total_count
    FROM ai_power_weight_rules
    WHERE is_active = true
  `);

  return toNumber(rows[0]?.total_count);
}

async function getMarketLearningCount(): Promise<number> {
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS total_count
    FROM market_learning_logs
  `);

  return toNumber(rows[0]?.total_count);
}

async function buildIssues(
  tables: LearningQualityTableSummary[],
  activeWeightRuleCount: number,
  marketLearningCount: number
): Promise<LearningQualityIssue[]> {
  const issues: LearningQualityIssue[] = [];

  for (const table of tables) {
    if (table.totalCount === 0) {
      issues.push({
        level: "WARN",
        tableName: table.tableName,
        code: "EMPTY_TABLE",
        message: `${table.tableName} に学習データがありません。`,
      });
    }

    if (table.totalCount > 0 && table.judgedCount === 0) {
      issues.push({
        level: "WARN",
        tableName: table.tableName,
        code: "NO_JUDGED_RECORDS",
        message: `${table.tableName} にWIN/LOSE判定済みデータがありません。`,
      });
    }

    if (table.unknownCount > 0) {
      issues.push({
        level: "INFO",
        tableName: table.tableName,
        code: "UNKNOWN_RESULTS",
        message: `${table.tableName} に未判定または不明なresultがあります。`,
        count: table.unknownCount,
      });
    }

    if (table.judgedCount > 0 && table.judgedCount < 30) {
      issues.push({
        level: "INFO",
        tableName: table.tableName,
        code: "LOW_SAMPLE_COUNT",
        message: `${table.tableName} の判定済みサンプルが少ないです。まず30件以上を目標にします。`,
        count: table.judgedCount,
      });
    }
  }

  if (activeWeightRuleCount === 0) {
    issues.push({
      level: "WARN",
      tableName: "ai_power_weight_rules",
      code: "NO_ACTIVE_WEIGHT_RULES",
      message: "有効なAI重みルールがありません。",
    });
  }

  if (marketLearningCount === 0) {
    issues.push({
      level: "INFO",
      tableName: "market_learning_logs",
      code: "NO_MARKET_LEARNING",
      message: "地合い学習ログがまだありません。",
    });
  }

  return issues;
}

function calcQualityScore(
  tables: LearningQualityTableSummary[],
  issues: LearningQualityIssue[],
  activeWeightRuleCount: number,
  marketLearningCount: number
): number {
  const totalRecords = tables.reduce((sum, table) => sum + table.totalCount, 0);
  const judgedRecords = tables.reduce((sum, table) => sum + table.judgedCount, 0);

  let score = 100;

  if (totalRecords === 0) score -= 35;
  if (judgedRecords === 0) score -= 35;
  if (judgedRecords > 0 && judgedRecords < 30) score -= 15;
  if (activeWeightRuleCount === 0) score -= 10;
  if (marketLearningCount === 0) score -= 5;

  score -= issues.filter((issue) => issue.level === "ERROR").length * 12;
  score -= issues.filter((issue) => issue.level === "WARN").length * 6;
  score -= issues.filter((issue) => issue.level === "INFO").length * 2;

  return Math.max(0, Math.min(100, score));
}

export async function buildPostgresLearningQualityReport(): Promise<LearningQualityReport> {
  const [
    dailySummary,
    patternSummary,
    sectorSummary,
    activeWeightRuleCount,
    marketLearningCount,
  ] = await Promise.all([
    summarizeResultTable("daily_stock_results"),
    summarizeResultTable("pattern_learning_logs"),
    summarizeSectorLearning(),
    getWeightRuleCount(),
    getMarketLearningCount(),
  ]);

  const tables = [dailySummary, patternSummary, sectorSummary];

  const issues = await buildIssues(
    tables,
    activeWeightRuleCount,
    marketLearningCount
  );

  issues.push({
    level: "INFO",
    tableName: "ai_power_weight_rules",
    code: "ACTIVE_WEIGHT_RULE_COUNT",
    message: "有効なAI重みルール数です。",
    count: activeWeightRuleCount,
  });

  issues.push({
    level: "INFO",
    tableName: "market_learning_logs",
    code: "MARKET_LEARNING_COUNT",
    message: "地合い学習ログ数です。",
    count: marketLearningCount,
  });

  const totalRecords = tables.reduce((sum, table) => sum + table.totalCount, 0);
  const totalWin = tables.reduce((sum, table) => sum + table.winCount, 0);
  const totalLose = tables.reduce((sum, table) => sum + table.loseCount, 0);
  const judgedRecords = totalWin + totalLose;
  const qualityScore = calcQualityScore(
    tables,
    issues,
    activeWeightRuleCount,
    marketLearningCount
  );

  return {
    checkedAt: new Date().toISOString(),
    qualityScore,
    qualityLabel: buildQualityLabel(qualityScore),
    totalRecords,
    judgedRecords,
    overallWinRate: calcWinRate(totalWin, totalLose),
    tables,
    issues,
  };
}
