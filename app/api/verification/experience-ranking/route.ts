import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        AVG(similarity)::numeric(10,2) AS average_similarity,
        AVG(bonus)::numeric(10,2) AS average_bonus,
        MAX(bonus)::int AS best_bonus
      FROM ai_power_recommendations
      WHERE experience_ranking_bonus IS NOT NULL
    `);

    return NextResponse.json({
      success: true,
      total: Number(rows[0]?.total ?? 0),
      averageSimilarity: Number(rows[0]?.average_similarity ?? 0),
      averageBonus: Number(rows[0]?.average_bonus ?? 0),
      bestBonus: Number(rows[0]?.best_bonus ?? 0),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Experience Ranking verification failed",
      },
      { status: 500 }
    );
  }
}