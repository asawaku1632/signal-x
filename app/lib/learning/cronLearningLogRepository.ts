import pool from "@/app/lib/postgres";

export type CronLearningLogStatus = "SUCCESS" | "ERROR";

export type CreateCronLearningLogInput = {
  status: CronLearningLogStatus;
  debugVersion: string;
  mode: string;
  judgeLimit: number;
  minSampleCount: number;
  processedCount: number;
  updatedCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  unknownCount: number;
  errorCount: number;
  weightRuleUpsertedCount: number;
  errorMessage?: string | null;
  rawReport?: unknown;
};

export type CronLearningLog = {
  id: number;
  status: CronLearningLogStatus;
  debugVersion: string;
  mode: string;
  judgeLimit: number;
  minSampleCount: number;
  processedCount: number;
  updatedCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  unknownCount: number;
  errorCount: number;
  weightRuleUpsertedCount: number;
  errorMessage?: string | null;
  createdAt: string;
};

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS cron_learning_logs (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL,
  debug_version TEXT NOT NULL,
  mode TEXT NOT NULL,
  judge_limit INTEGER NOT NULL DEFAULT 0,
  min_sample_count INTEGER NOT NULL DEFAULT 3,
  processed_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  lose_count INTEGER NOT NULL DEFAULT 0,
  hold_count INTEGER NOT NULL DEFAULT 0,
  unknown_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  weight_rule_upserted_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  raw_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value) return String(value);
  return new Date().toISOString();
}

async function ensureCronLearningLogsTable() {
  await pool.query(CREATE_TABLE_SQL);
}

export async function createCronLearningLog(
  input: CreateCronLearningLogInput
): Promise<CronLearningLog | null> {
  await ensureCronLearningLogsTable();

  const { rows } = await pool.query(
    `
    INSERT INTO cron_learning_logs (
      status,
      debug_version,
      mode,
      judge_limit,
      min_sample_count,
      processed_count,
      updated_count,
      win_count,
      lose_count,
      hold_count,
      unknown_count,
      error_count,
      weight_rule_upserted_count,
      error_message,
      raw_report
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15
    )
    RETURNING
      id,
      status,
      debug_version,
      mode,
      judge_limit,
      min_sample_count,
      processed_count,
      updated_count,
      win_count,
      lose_count,
      hold_count,
      unknown_count,
      error_count,
      weight_rule_upserted_count,
      error_message,
      created_at
    `,
    [
      input.status,
      input.debugVersion,
      input.mode,
      input.judgeLimit,
      input.minSampleCount,
      input.processedCount,
      input.updatedCount,
      input.winCount,
      input.loseCount,
      input.holdCount,
      input.unknownCount,
      input.errorCount,
      input.weightRuleUpsertedCount,
      input.errorMessage ?? null,
      JSON.stringify(input.rawReport ?? null),
    ]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: toNumber(row.id),
    status: String(row.status) as CronLearningLogStatus,
    debugVersion: String(row.debug_version),
    mode: String(row.mode),
    judgeLimit: toNumber(row.judge_limit),
    minSampleCount: toNumber(row.min_sample_count),
    processedCount: toNumber(row.processed_count),
    updatedCount: toNumber(row.updated_count),
    winCount: toNumber(row.win_count),
    loseCount: toNumber(row.lose_count),
    holdCount: toNumber(row.hold_count),
    unknownCount: toNumber(row.unknown_count),
    errorCount: toNumber(row.error_count),
    weightRuleUpsertedCount: toNumber(row.weight_rule_upserted_count),
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: toDateString(row.created_at),
  };
}

export async function getRecentCronLearningLogs(limit = 20): Promise<CronLearningLog[]> {
  await ensureCronLearningLogsTable();

  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  const { rows } = await pool.query(
    `
    SELECT
      id,
      status,
      debug_version,
      mode,
      judge_limit,
      min_sample_count,
      processed_count,
      updated_count,
      win_count,
      lose_count,
      hold_count,
      unknown_count,
      error_count,
      weight_rule_upserted_count,
      error_message,
      created_at
    FROM cron_learning_logs
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return rows.map((row: any) => ({
    id: toNumber(row.id),
    status: String(row.status) as CronLearningLogStatus,
    debugVersion: String(row.debug_version),
    mode: String(row.mode),
    judgeLimit: toNumber(row.judge_limit),
    minSampleCount: toNumber(row.min_sample_count),
    processedCount: toNumber(row.processed_count),
    updatedCount: toNumber(row.updated_count),
    winCount: toNumber(row.win_count),
    loseCount: toNumber(row.lose_count),
    holdCount: toNumber(row.hold_count),
    unknownCount: toNumber(row.unknown_count),
    errorCount: toNumber(row.error_count),
    weightRuleUpsertedCount: toNumber(row.weight_rule_upserted_count),
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: toDateString(row.created_at),
  }));
}
