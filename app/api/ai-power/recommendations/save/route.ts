import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { calculatePatternBonus } from "@/app/lib/patternBonus";

type RecommendationItem = {
  patternKey: string;
  currentBonus: number;
  recommendedBonus: number;
  winRate: number;
  sampleCount: number;
  evaluation: string;
  reason: string;
};

function evaluatePattern(winRate: number, judged: number) {
  if (judged < 10) {
    return {
      evaluation: "NOT_ENOUGH_DATA",
      reason: "判定件数が10件未満のため、補正変更は保留。",
    };
  }

  if (winRate >= 85) {
    return {
      evaluation: "EXCELLENT",
      reason: "勝率が非常に高く、強い加点候補。",
    };
  }

  if (winRate >= 75) {
    return {
      evaluation: "GOOD",
      reason: "勝率が高く、加点候補。",
    };
  }

  if (winRate >= 65) {
    return {
      evaluation: "NORMAL_PLUS",
      reason: "やや優位性があり、軽い加点候補。",
    };
  }

  if (winRate >= 55) {
    return {
      evaluation: "NORMAL",
      reason: "わずかに優位性あり。控えめな加点候補。",
    };
  }

  if (winRate >= 45) {
    return {
      evaluation: "NEUTRAL",
      reason: "明確な優位性はなく、補正なしが妥当。",
    };
  }

  if (winRate >= 35) {
    return {
      evaluation: "WEAK",
      reason: "勝率が低めで、軽い減点候補。",
    };
  }

  if (winRate >= 25) {
    return {
      evaluation: "BAD",
      reason: "勝率が低く、減点候補。",
    };
  }

  return {
    evaluation: "VERY_BAD",
    reason: "勝率が非常に低く、強い減点候補。",
  };
}

async function saveRecommendations(items: RecommendationItem[]) {
  if (items.length === 0) {
    return {
      saved: 0,
    };
  }

  const values: any[] = [];
  const placeholders: string[] = [];

  items.forEach((item, index) => {
    const base = index * 7;

    values.push(
      item.patternKey,
      item.currentBonus,
      item.recommendedBonus,
      item.winRate,
      item.sampleCount,
      item.evaluation,
      item.reason
    );

    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, $${base + 6}, $${base + 7})`
    );
  });

  await pool.query(
    `
    INSERT INTO ai_power_recommendations (
      pattern_key,
      current_bonus,
      recommended_bonus,
      win_rate,
      sample_count,
      evaluation,
      reason
    )
    VALUES ${placeholders.join(",")}
    `,
    values
  );

  return {
    saved: items.length,
  };
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
        SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END)::int AS win,
        SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END)::int AS lose
      FROM pattern_learning_logs
      WHERE pattern_key IS NOT NULL
      GROUP BY pattern_key
      ORDER BY COUNT(*) DESC
      LIMIT $1
      `,
      [limit]
    );

    const recommendations: RecommendationItem[] = rows.map((row) => {
      const patternKey = String(row.pattern_key);
      const win = Number(row.win || 0);
      const lose = Number(row.lose || 0);
      const judged = win + lose;
      const winRate = judged === 0 ? 0 : Math.round((win / judged) * 100);

      const current = calculatePatternBonus({ win, lose });
      const evaluation = evaluatePattern(winRate, judged);

      return {
        patternKey,
        currentBonus: current.bonus,
        recommendedBonus: current.baseBonus,
        winRate,
        sampleCount: judged,
        evaluation: evaluation.evaluation,
        reason: evaluation.reason,
      };
    });

    const result = await saveRecommendations(recommendations);

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V6.2_RECOMMENDATIONS",
      checked: recommendations.length,
      ...result,
      recommendations,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("ai power recommendations save error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "AI_POWER_RECOMMENDATIONS_SAVE_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}