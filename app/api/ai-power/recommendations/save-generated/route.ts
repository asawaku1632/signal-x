import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export async function GET() {
  try {
    const baseUrl = "http://localhost:3000";

    const res = await fetch(
      `${baseUrl}/api/ai-power/recommendations/generate`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (!data.success) {
      throw new Error("Failed to generate recommendations");
    }

    const recommendations = data.recommendations ?? [];

    let savedCount = 0;

    for (const item of recommendations) {
      const patternKey = `${item.category}:${item.key}`;

      await pool.query(
        `
        INSERT INTO ai_power_recommendations (
          pattern_key,
          current_bonus,
          recommended_bonus,
          reason,
          sample_count,
          win_rate,
          evaluation,
          applied,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          false,
          NOW()
        )
        `,
        [
          patternKey,
          0,
          item.recommendedBonus,
          `${item.category} ${item.key} は過去${item.sampleCount}件で勝率${item.winRate}%のため、AI POWER補正 ${item.recommendedBonus} を提案`,
          item.sampleCount,
          item.winRate,
          item.evaluation,
        ]
      );

      savedCount++;
    }

    return NextResponse.json({
      success: true,
      savedCount,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
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