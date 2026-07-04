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
        l.sector_key,
        l.sector_name,
        SUM(l.win_count)::int AS win,
        SUM(l.lose_count)::int AS lose,
        SUM(l.hold_count)::int AS hold,
        SUM(l.judged_count)::int AS total,
        COALESCE(MAX(r.bonus), 0)::int AS ai_bonus,
        COALESCE(MAX(r.confidence), 0)::int AS confidence
      FROM sector_learning_logs l
      LEFT JOIN ai_power_weight_rules r
        ON r.rule_type = 'SECTOR'
       AND r.rule_key = l.sector_key
       AND r.is_active = true
      GROUP BY l.sector_key, l.sector_name
      ORDER BY total DESC
    `);

    const sectors = rows
      .map((row) => {
        const win = Number(row.win ?? 0);
        const lose = Number(row.lose ?? 0);
        const hold = Number(row.hold ?? 0);
        const total = Number(row.total ?? win + lose + hold);

        const winRate =
          total > 0 ? Math.round((win / total) * 100) : 0;

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
          evaluation: getEvaluation(winRate, total),
        };
      })
      .sort((a, b) => {
        if (b.winRate !== a.winRate) {
          return b.winRate - a.winRate;
        }
        return b.total - a.total;
      })
      .map((sector, index) => ({
        rank: index + 1,
        rankLabel: getRankLabel(index),
        ...sector,
      }));

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.6_SECTOR_DASHBOARD",
      sectorCount: sectors.length,
      sectors,
    });
  } catch (error) {
    console.error("sector dashboard error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.6_SECTOR_DASHBOARD",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}