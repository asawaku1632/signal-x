import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function getRankLabel(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}位`;
}

function getEvaluation(winRate: number, total: number) {
  if (total < 10) return "NOT_ENOUGH_DATA";
  if (winRate >= 90) return "S_STRONG_SECTOR";
  if (winRate >= 80) return "A_STRONG_SECTOR";
  if (winRate >= 70) return "B_GOOD_SECTOR";
  if (winRate >= 60) return "C_WATCH_SECTOR";
  if (winRate >= 45) return "KEEP";
  return "WEAK_SECTOR";
}

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        latest.sector_key,
        latest.sector_name,
        COALESCE(latest.win_count, 0)::int AS win,
        COALESCE(latest.lose_count, 0)::int AS lose,
        COALESCE(latest.hold_count, 0)::int AS hold,
        COALESCE(latest.judged_count, 0)::int AS total,
        COALESCE(latest.win_rate, 0)::numeric AS win_rate,
        COALESCE(latest.ai_bonus, 0)::int AS calculated_bonus,
        COALESCE(latest.confidence, 0)::int AS calculated_confidence,
        COALESCE(r.bonus, latest.ai_bonus, 0)::int AS ai_bonus,
        COALESCE(r.confidence, latest.confidence, 0)::int AS confidence,
        latest.trade_date,
        r.updated_at AS rule_updated_at
      FROM (
        SELECT DISTINCT ON (sector_key)
          sector_key,
          sector_name,
          win_count,
          lose_count,
          hold_count,
          judged_count,
          win_rate,
          ai_bonus,
          confidence,
          trade_date
        FROM sector_learning_logs
        WHERE judged_count >= 0
        ORDER BY sector_key, trade_date DESC
      ) latest
      LEFT JOIN ai_power_weight_rules r
        ON r.rule_type = 'SECTOR'
       AND r.rule_key = latest.sector_key
       AND r.is_active = true
    `);

    const sectors = rows
      .map((row) => {
        const win = Number(row.win ?? 0);
        const lose = Number(row.lose ?? 0);
        const hold = Number(row.hold ?? 0);
        const total = Number(row.total ?? win + lose + hold);
        const winRate = Math.round(Number(row.win_rate ?? 0));

        return {
          sectorKey: row.sector_key,
          sectorName: row.sector_name,
          win,
          lose,
          hold,
          total,
          winRate,
          aiBonus: Number(row.ai_bonus ?? 0),
          confidence: Number(row.confidence ?? 0),
          calculatedBonus: Number(row.calculated_bonus ?? 0),
          calculatedConfidence: Number(row.calculated_confidence ?? 0),
          tradeDate: row.trade_date,
          ruleUpdatedAt: row.rule_updated_at,
          evaluation: getEvaluation(winRate, total),
        };
      })
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return b.total - a.total;
      })
      .map((sector, index) => ({
        rank: index + 1,
        rankLabel: getRankLabel(index),
        ...sector,
      }));

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.6.1_SECTOR_DASHBOARD_LATEST",
      sectorCount: sectors.length,
      sectors,
    });
  } catch (error) {
    console.error("sector dashboard error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.6.1_SECTOR_DASHBOARD_LATEST",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}