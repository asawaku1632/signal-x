import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

type CandidateRow = {
  pattern_key: string;
  recommended_bonus: number;
  win_rate: number;
  sample_count: number;
  evaluation: string;
  recommendation_count: number;
};

const MIN_SAMPLE_COUNT = 10;
const MIN_RECOMMENDATION_COUNT = 1;

function shouldApply(row: CandidateRow) {
  if (row.sample_count < MIN_SAMPLE_COUNT) return false;
  if (row.recommendation_count < MIN_RECOMMENDATION_COUNT) return false;
  if (row.evaluation === "NOT_ENOUGH_DATA") return false;

  return true;
}

function getConfidence(sampleCount: number) {
  if (sampleCount >= 100) return 100;
  if (sampleCount >= 30) return 80;
  if (sampleCount >= 10) return 50;
  return 0;
}

export async function GET(req: Request) {
  const startedAt = Date.now();

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 100);

    const { rows } = await pool.query(
      `
      SELECT
        pattern_key,
        recommended_bonus,
        win_rate,
        sample_count,
        evaluation,
        COUNT(*)::int AS recommendation_count
      FROM ai_power_recommendations
      WHERE applied = false
      GROUP BY
        pattern_key,
        recommended_bonus,
        win_rate,
        sample_count,
        evaluation
      ORDER BY sample_count DESC
      LIMIT $1
      `,
      [limit]
    );

    const candidates = rows as CandidateRow[];
    const appliedCandidates = candidates.filter(shouldApply);

    let applied = 0;

    for (const item of appliedCandidates) {
      const confidence = getConfidence(item.sample_count);

      const [ruleType, ruleKey] = item.pattern_key.includes(":")
        ? item.pattern_key.split(":")
        : ["PATTERN", item.pattern_key];

      const previous = await pool.query(
        `
        SELECT bonus
        FROM ai_power_weight_rules
        WHERE rule_type = $1
          AND rule_key = $2
        LIMIT 1
        `,
        [ruleType, ruleKey]
      );

      const oldBonus = previous.rows[0]?.bonus ?? 0;

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
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          0,
          0,
          $6,
          true,
          NOW()
        )
        ON CONFLICT (rule_type, rule_key)
        DO UPDATE SET
          bonus = EXCLUDED.bonus,
          win_rate = EXCLUDED.win_rate,
          sample_count = EXCLUDED.sample_count,
          confidence = EXCLUDED.confidence,
          is_active = true,
          updated_at = NOW()
        `,
        [
          ruleType,
          ruleKey,
          item.recommended_bonus,
          item.win_rate,
          item.sample_count,
          confidence,
        ]
      );

      await pool.query(
        `
        INSERT INTO ai_power_evolution_logs (
          rule_type,
          rule_key,
          old_bonus,
          new_bonus,
          win_rate,
          sample_count,
          reason
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
        `,
        [
          ruleType,
          ruleKey,
          oldBonus,
          item.recommended_bonus,
          item.win_rate,
          item.sample_count,
          `${ruleType} ${ruleKey} updated automatically`,
        ]
      );

      await pool.query(
        `
        UPDATE ai_power_recommendations
        SET applied = true
        WHERE
          pattern_key = $1
          AND recommended_bonus = $2
          AND applied = false
        `,
        [item.pattern_key, item.recommended_bonus]
      );

      applied++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V11.1_EVOLUTION_HISTORY",
      checked: candidates.length,
      applied,
      skipped: candidates.length - applied,
      rulesUpdated: applied,
      evolutionLogsAdded: applied,
      candidates,
      appliedCandidates,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("apply recommendations error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "AI_POWER_APPLY_RECOMMENDATIONS_FAILED",
        message:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}