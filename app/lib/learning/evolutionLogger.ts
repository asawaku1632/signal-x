import pool from "@/app/lib/postgres";
import { evaluateAiPowerAccuracy } from "@/app/lib/learning/accuracyEvaluator";
import { optimizeWeightRules } from "@/app/lib/learning/weightOptimizer";

export type EvolutionLogMode = "preview" | "execute";

export type EvolutionLogSnapshot = {
  qualityScore: number;
  qualityLabel: string;
  totalRecords: number;
  judgedRecords: number;
  overallWinRate: number;
  dailyJudgedCount: number;
  patternJudgedCount: number;
  sectorJudgedCount: number;
  activeWeightRuleCount: number;
  marketLearningCount: number;
  cronLatestStatus: string | null;
  cronLatestUpdatedCount: number;
  cronLatestWeightRuleUpsertedCount: number;
};

export type EvolutionLogReport = {
  success: boolean;
  debugVersion: string;
  checkedAt: string;
  mode: EvolutionLogMode;
  snapshot: EvolutionLogSnapshot;
  accuracy: Awaited<ReturnType<typeof evaluateAiPowerAccuracy>>;
  weightOptimizationPreview: Awaited<ReturnType<typeof optimizeWeightRules>>;
  savedLog: EvolutionLogRecord | null;
  nextAction: string;
};

export type EvolutionLogRecord = {
  id: number;
  qualityScore: number;
  qualityLabel: string;
  judgedRecords: number;
  overallWinRate: number;
  patternJudgedCount: number;
  activeWeightRuleCount: number;
  accuracyWeakCount: number;
  accuracyBoostCount: number;
  accuracyReduceCount: number;
  weightChangedCount: number;
  weightOptimizedCount: number;
  cronLatestStatus: string | null;
  createdAt: string;
};

const DEBUG_VERSION = "V24_3_EVOLUTION_LOGGER_0707";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS learning_evolution_logs (
  id BIGSERIAL PRIMARY KEY,
  debug_version TEXT NOT NULL,
  quality_score NUMERIC NOT NULL DEFAULT 0,
  quality_label TEXT NOT NULL DEFAULT 'UNKNOWN',
  total_records INTEGER NOT NULL DEFAULT 0,
  judged_records INTEGER NOT NULL DEFAULT 0,
  overall_win_rate NUMERIC NOT NULL DEFAULT 0,
  daily_judged_count INTEGER NOT NULL DEFAULT 0,
  pattern_judged_count INTEGER NOT NULL DEFAULT 0,
  sector_judged_count INTEGER NOT NULL DEFAULT 0,
  active_weight_rule_count INTEGER NOT NULL DEFAULT 0,
  market_learning_count INTEGER NOT NULL DEFAULT 0,
  accuracy_weak_count INTEGER NOT NULL DEFAULT 0,
  accuracy_boost_count INTEGER NOT NULL DEFAULT 0,
  accuracy_reduce_count INTEGER NOT NULL DEFAULT 0,
  accuracy_watch_count INTEGER NOT NULL DEFAULT 0,
  weight_target_count INTEGER NOT NULL DEFAULT 0,
  weight_changed_count INTEGER NOT NULL DEFAULT 0,
  weight_optimized_count INTEGER NOT NULL DEFAULT 0,
  cron_latest_status TEXT,
  cron_latest_updated_count INTEGER NOT NULL DEFAULT 0,
  cron_latest_weight_rule_upserted_count INTEGER NOT NULL DEFAULT 0,
  raw_snapshot JSONB,
  raw_accuracy JSONB,
  raw_weight_preview JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function normalizeMode(value: string | null | undefined): EvolutionLogMode {
  return value === "execute" ? "execute" : "preview";
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value) return String(value);
  return new Date().toISOString();
}

async function ensureEvolutionLogTable() {
  await pool.query(CREATE_TABLE_SQL);
}

async function fetchCount(tableName: string): Promise<number> {
  const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${safeTableName}`);
  return toNumber(rows[0]?.count);
}

async function tableExists(tableName: string): Promise<boolean> {
  const { rows } = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_name = $1
    ) AS exists
    `,
    [tableName]
  );

  return Boolean(rows[0]?.exists);
}

async function fetchLatestCronLog() {
  const exists = await tableExists("cron_learning_logs");
  if (!exists) return null;

  const { rows } = await pool.query(
    `
    SELECT
      status,
      updated_count,
      weight_rule_upserted_count,
      created_at
    FROM cron_learning_logs
    ORDER BY created_at DESC
    LIMIT 1
    `
  );

  return rows[0] ?? null;
}

async function fetchQualitySnapshot(): Promise<EvolutionLogSnapshot> {
  const daily = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS win_count,
      COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose_count,
      COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold_count,
      COUNT(*) FILTER (WHERE result IS NULL OR result = 'UNKNOWN')::int AS unknown_count
    FROM daily_stock_results
    `
  );

  const pattern = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS win_count,
      COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose_count,
      COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold_count,
      COUNT(*) FILTER (WHERE result IS NULL OR result = 'UNKNOWN')::int AS unknown_count
    FROM pattern_learning_logs
    `
  );

  const sector = await pool.query(
    `
    SELECT
      COALESCE(SUM(win_count), 0)::int AS win_count,
      COALESCE(SUM(lose_count), 0)::int AS lose_count,
      COALESCE(SUM(hold_count), 0)::int AS hold_count
    FROM sector_learning_logs
    `
  );

  const activeWeightRuleCount = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM ai_power_weight_rules
    WHERE is_active = true
    `
  );

  const marketLearningCount = await fetchCount("market_learning_logs").catch(() => 0);
  const cronLatest = await fetchLatestCronLog();

  const dailyRow = daily.rows[0] ?? {};
  const patternRow = pattern.rows[0] ?? {};
  const sectorRow = sector.rows[0] ?? {};

  const dailyWin = toNumber(dailyRow.win_count);
  const dailyLose = toNumber(dailyRow.lose_count);
  const dailyJudged = dailyWin + dailyLose;

  const patternWin = toNumber(patternRow.win_count);
  const patternLose = toNumber(patternRow.lose_count);
  const patternJudged = patternWin + patternLose;

  const sectorWin = toNumber(sectorRow.win_count);
  const sectorLose = toNumber(sectorRow.lose_count);
  const sectorJudged = sectorWin + sectorLose;

  const totalRecords =
    toNumber(dailyRow.total_count) + toNumber(patternRow.total_count) + sectorJudged;

  const judgedRecords = dailyJudged + patternJudged + sectorJudged;
  const totalWin = dailyWin + patternWin + sectorWin;
  const totalLose = dailyLose + patternLose + sectorLose;
  const overallWinRate =
    totalWin + totalLose > 0
      ? Math.round((totalWin / (totalWin + totalLose)) * 1000) / 10
      : 0;

  let qualityScore = 70;
  if (judgedRecords >= 1000) qualityScore += 10;
  if (patternJudged >= 30) qualityScore += 10;
  if (toNumber(activeWeightRuleCount.rows[0]?.count) >= 30) qualityScore += 5;
  if (overallWinRate >= 60) qualityScore += 5;
  if (qualityScore > 100) qualityScore = 100;

  const qualityLabel =
    qualityScore >= 90
      ? "EXCELLENT"
      : qualityScore >= 80
      ? "GOOD"
      : qualityScore >= 70
      ? "NORMAL"
      : "NEEDS_ATTENTION";

  return {
    qualityScore,
    qualityLabel,
    totalRecords,
    judgedRecords,
    overallWinRate,
    dailyJudgedCount: dailyJudged,
    patternJudgedCount: patternJudged,
    sectorJudgedCount: sectorJudged,
    activeWeightRuleCount: toNumber(activeWeightRuleCount.rows[0]?.count),
    marketLearningCount,
    cronLatestStatus: cronLatest?.status ? String(cronLatest.status) : null,
    cronLatestUpdatedCount: toNumber(cronLatest?.updated_count),
    cronLatestWeightRuleUpsertedCount: toNumber(
      cronLatest?.weight_rule_upserted_count
    ),
  };
}

async function saveEvolutionLog(input: {
  snapshot: EvolutionLogSnapshot;
  accuracy: Awaited<ReturnType<typeof evaluateAiPowerAccuracy>>;
  weightOptimizationPreview: Awaited<ReturnType<typeof optimizeWeightRules>>;
}): Promise<EvolutionLogRecord | null> {
  await ensureEvolutionLogTable();

  const { snapshot, accuracy, weightOptimizationPreview } = input;

  const { rows } = await pool.query(
    `
    INSERT INTO learning_evolution_logs (
      debug_version,
      quality_score,
      quality_label,
      total_records,
      judged_records,
      overall_win_rate,
      daily_judged_count,
      pattern_judged_count,
      sector_judged_count,
      active_weight_rule_count,
      market_learning_count,
      accuracy_weak_count,
      accuracy_boost_count,
      accuracy_reduce_count,
      accuracy_watch_count,
      weight_target_count,
      weight_changed_count,
      weight_optimized_count,
      cron_latest_status,
      cron_latest_updated_count,
      cron_latest_weight_rule_upserted_count,
      raw_snapshot,
      raw_accuracy,
      raw_weight_preview
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23, $24
    )
    RETURNING
      id,
      quality_score,
      quality_label,
      judged_records,
      overall_win_rate,
      pattern_judged_count,
      active_weight_rule_count,
      accuracy_weak_count,
      accuracy_boost_count,
      accuracy_reduce_count,
      weight_changed_count,
      weight_optimized_count,
      cron_latest_status,
      created_at
    `,
    [
      DEBUG_VERSION,
      snapshot.qualityScore,
      snapshot.qualityLabel,
      snapshot.totalRecords,
      snapshot.judgedRecords,
      snapshot.overallWinRate,
      snapshot.dailyJudgedCount,
      snapshot.patternJudgedCount,
      snapshot.sectorJudgedCount,
      snapshot.activeWeightRuleCount,
      snapshot.marketLearningCount,
      accuracy.summary.weakCount,
      accuracy.summary.boostCount,
      accuracy.summary.reduceCount,
      accuracy.summary.watchCount,
      weightOptimizationPreview.targetCount,
      weightOptimizationPreview.changedCount,
      weightOptimizationPreview.optimizedCount,
      snapshot.cronLatestStatus,
      snapshot.cronLatestUpdatedCount,
      snapshot.cronLatestWeightRuleUpsertedCount,
      JSON.stringify(snapshot),
      JSON.stringify(accuracy),
      JSON.stringify(weightOptimizationPreview),
    ]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: toNumber(row.id),
    qualityScore: toNumber(row.quality_score),
    qualityLabel: String(row.quality_label),
    judgedRecords: toNumber(row.judged_records),
    overallWinRate: toNumber(row.overall_win_rate),
    patternJudgedCount: toNumber(row.pattern_judged_count),
    activeWeightRuleCount: toNumber(row.active_weight_rule_count),
    accuracyWeakCount: toNumber(row.accuracy_weak_count),
    accuracyBoostCount: toNumber(row.accuracy_boost_count),
    accuracyReduceCount: toNumber(row.accuracy_reduce_count),
    weightChangedCount: toNumber(row.weight_changed_count),
    weightOptimizedCount: toNumber(row.weight_optimized_count),
    cronLatestStatus: row.cron_latest_status ? String(row.cron_latest_status) : null,
    createdAt: toDateString(row.created_at),
  };
}

export async function runEvolutionLogger(options?: {
  mode?: string | null;
  minJudgedCount?: number;
  weightLimit?: number;
  minSampleCount?: number;
}): Promise<EvolutionLogReport> {
  const mode = normalizeMode(options?.mode);

  const [snapshot, accuracy, weightOptimizationPreview] = await Promise.all([
    fetchQualitySnapshot(),
    evaluateAiPowerAccuracy({
      mode: "preview",
      minJudgedCount: options?.minJudgedCount ?? 5,
    }),
    optimizeWeightRules({
      mode: "preview",
      limit: options?.weightLimit ?? 100,
      minSampleCount: options?.minSampleCount ?? 3,
    }),
  ]);

  const savedLog =
    mode === "execute"
      ? await saveEvolutionLog({
          snapshot,
          accuracy,
          weightOptimizationPreview,
        })
      : null;

  return {
    success: true,
    debugVersion: DEBUG_VERSION,
    checkedAt: new Date().toISOString(),
    mode,
    snapshot,
    accuracy,
    weightOptimizationPreview,
    savedLog,
    nextAction:
      mode === "preview"
        ? "内容を確認し、問題なければ mode=execute で進化ログを保存してください。"
        : "進化ログ保存完了。次はcron daily-learningへ接続して毎日自動保存します。",
  };
}

export async function getRecentEvolutionLogs(limit = 10): Promise<EvolutionLogRecord[]> {
  await ensureEvolutionLogTable();

  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  const { rows } = await pool.query(
    `
    SELECT
      id,
      quality_score,
      quality_label,
      judged_records,
      overall_win_rate,
      pattern_judged_count,
      active_weight_rule_count,
      accuracy_weak_count,
      accuracy_boost_count,
      accuracy_reduce_count,
      weight_changed_count,
      weight_optimized_count,
      cron_latest_status,
      created_at
    FROM learning_evolution_logs
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return rows.map((row: any) => ({
    id: toNumber(row.id),
    qualityScore: toNumber(row.quality_score),
    qualityLabel: String(row.quality_label),
    judgedRecords: toNumber(row.judged_records),
    overallWinRate: toNumber(row.overall_win_rate),
    patternJudgedCount: toNumber(row.pattern_judged_count),
    activeWeightRuleCount: toNumber(row.active_weight_rule_count),
    accuracyWeakCount: toNumber(row.accuracy_weak_count),
    accuracyBoostCount: toNumber(row.accuracy_boost_count),
    accuracyReduceCount: toNumber(row.accuracy_reduce_count),
    weightChangedCount: toNumber(row.weight_changed_count),
    weightOptimizedCount: toNumber(row.weight_optimized_count),
    cronLatestStatus: row.cron_latest_status ? String(row.cron_latest_status) : null,
    createdAt: toDateString(row.created_at),
  }));
}
