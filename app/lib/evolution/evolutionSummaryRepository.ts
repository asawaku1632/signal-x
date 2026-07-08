import pool from "@/app/lib/postgres";

export type EvolutionSummaryInput = {
  qualityScore: number;
  qualityLabel: string;
  judgedRecords: number;
  overallWinRate: number;
  patternCount: number;
  sectorCount: number;
  activeWeightRules: number;
  optimizedCount: number;
  changedCount: number;
  cronStatus: string;
};

export type EvolutionSummary = {
  id: number;
  qualityScore: number;
  qualityLabel: string;
  judgedRecords: number;
  overallWinRate: number;
  patternCount: number;
  sectorCount: number;
  activeWeightRules: number;
  optimizedCount: number;
  changedCount: number;
  cronStatus: string;
  createdAt: string;
};

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value) return String(value);
  return new Date().toISOString();
}

function mapRow(row: any): EvolutionSummary {
  return {
    id: toNumber(row.id),
    qualityScore: toNumber(row.quality_score),
    qualityLabel: String(row.quality_label ?? "UNKNOWN"),
    judgedRecords: toNumber(row.judged_records),
    overallWinRate: toNumber(row.overall_win_rate),
    patternCount: toNumber(row.pattern_count),
    sectorCount: toNumber(row.sector_count),
    activeWeightRules: toNumber(row.active_weight_rules),
    optimizedCount: toNumber(row.optimized_count),
    changedCount: toNumber(row.changed_count),
    cronStatus: String(row.cron_status ?? "UNKNOWN"),
    createdAt: toDateString(row.created_at),
  };
}

export async function createEvolutionSummary(
  input: EvolutionSummaryInput
): Promise<EvolutionSummary | null> {
  const { rows } = await pool.query(
    `
    INSERT INTO ai_evolution_summary (
      quality_score,
      quality_label,
      judged_records,
      overall_win_rate,
      pattern_count,
      sector_count,
      active_weight_rules,
      optimized_count,
      changed_count,
      cron_status
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10
    )
    RETURNING
      id,
      quality_score,
      quality_label,
      judged_records,
      overall_win_rate,
      pattern_count,
      sector_count,
      active_weight_rules,
      optimized_count,
      changed_count,
      cron_status,
      created_at
    `,
    [
      input.qualityScore,
      input.qualityLabel,
      input.judgedRecords,
      input.overallWinRate,
      input.patternCount,
      input.sectorCount,
      input.activeWeightRules,
      input.optimizedCount,
      input.changedCount,
      input.cronStatus,
    ]
  );

  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function getLatestEvolutionSummary(): Promise<EvolutionSummary | null> {
  const { rows } = await pool.query(
    `
    SELECT
      id,
      quality_score,
      quality_label,
      judged_records,
      overall_win_rate,
      pattern_count,
      sector_count,
      active_weight_rules,
      optimized_count,
      changed_count,
      cron_status,
      created_at
    FROM ai_evolution_summary
    ORDER BY created_at DESC
    LIMIT 1
    `
  );

  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function getEvolutionHistory(
  limit = 30
): Promise<EvolutionSummary[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  const { rows } = await pool.query(
    `
    SELECT
      id,
      quality_score,
      quality_label,
      judged_records,
      overall_win_rate,
      pattern_count,
      sector_count,
      active_weight_rules,
      optimized_count,
      changed_count,
      cron_status,
      created_at
    FROM ai_evolution_summary
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return rows.map(mapRow);
}

export async function createEvolutionSummaryFromLatestLog(): Promise<EvolutionSummary | null> {
  const { rows } = await pool.query(
    `
    SELECT
      quality_score,
      quality_label,
      judged_records,
      overall_win_rate,
      pattern_judged_count,
      active_weight_rule_count,
      weight_optimized_count,
      weight_changed_count,
      cron_latest_status
    FROM learning_evolution_logs
    ORDER BY created_at DESC
    LIMIT 1
    `
  );

  const latest = rows[0];
  if (!latest) return null;

  return createEvolutionSummary({
    qualityScore: toNumber(latest.quality_score),
    qualityLabel: String(latest.quality_label ?? "UNKNOWN"),
    judgedRecords: toNumber(latest.judged_records),
    overallWinRate: toNumber(latest.overall_win_rate),
    patternCount: toNumber(latest.pattern_judged_count),
    sectorCount: 0,
    activeWeightRules: toNumber(latest.active_weight_rule_count),
    optimizedCount: toNumber(latest.weight_optimized_count),
    changedCount: toNumber(latest.weight_changed_count),
    cronStatus: String(latest.cron_latest_status ?? "UNKNOWN"),
  });
}
