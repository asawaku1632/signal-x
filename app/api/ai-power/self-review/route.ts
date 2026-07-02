import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { calculatePatternBonus } from "@/app/lib/patternBonus";

type ReviewItem = {
  patternKey: string;
  total: number;
  win: number;
  lose: number;
  winRate: number;
  currentBonus: number;
  recommendedBonus: number;
  confidenceRate: number;
  evaluation: string;
  comment: string;
};

function evaluatePattern(winRate: number, total: number) {
  if (total < 10) {
    return {
      evaluation: "NOT_ENOUGH_DATA",
      comment: "判定件数が少ないため、まだ補正判断は保留です。",
    };
  }

  if (winRate >= 80) {
    return {
      evaluation: "EXCELLENT",
      comment: "非常に強いパターンです。積極的な加点候補です。",
    };
  }

  if (winRate >= 70) {
    return {
      evaluation: "GOOD",
      comment: "安定して強いパターンです。加点対象として妥当です。",
    };
  }

  if (winRate >= 60) {
    return {
      evaluation: "NORMAL",
      comment: "やや優位性があります。控えめな加点が妥当です。",
    };
  }

  if (winRate >= 45) {
    return {
      evaluation: "NEUTRAL",
      comment: "明確な優位性はまだありません。補正は抑えるべきです。",
    };
  }

  if (winRate >= 35) {
    return {
      evaluation: "WEAK",
      comment: "やや弱いパターンです。減点候補です。",
    };
  }

  return {
    evaluation: "BAD",
    comment: "かなり弱いパターンです。強めの減点候補です。",
  };
}

function createSummary(items: ReviewItem[]) {
  const total = items.length;
  const excellent = items.filter((item) => item.evaluation === "EXCELLENT").length;
  const good = items.filter((item) => item.evaluation === "GOOD").length;
  const weak = items.filter(
    (item) => item.evaluation === "WEAK" || item.evaluation === "BAD"
  ).length;
  const notEnough = items.filter(
    (item) => item.evaluation === "NOT_ENOUGH_DATA"
  ).length;

  return {
    total,
    excellent,
    good,
    weak,
    notEnough,
    comment:
      total === 0
        ? "自己分析対象のパターンはまだありません。"
        : `自己分析対象${total}件のうち、強いパターン${excellent + good}件、弱いパターン${weak}件、データ不足${notEnough}件です。`,
  };
}
export async function GET(req: Request) {
  const startedAt = Date.now();

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 50);

    const { rows } = await pool.query(
      `
      SELECT
        pattern_key,
        COUNT(*)::int AS total,
        SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END)::int AS win,
        SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END)::int AS lose
      FROM pattern_learning_logs
      WHERE pattern_key IS NOT NULL
      GROUP BY pattern_key
      ORDER BY total DESC
      LIMIT $1
      `,
      [limit]
    );

    const reviews: ReviewItem[] = rows.map((row) => {
      const patternKey = String(row.pattern_key);
      const total = Number(row.total || 0);
      const win = Number(row.win || 0);
      const lose = Number(row.lose || 0);
      const judged = win + lose;
      const winRate = judged === 0 ? 0 : Math.round((win / judged) * 100);

      const current = calculatePatternBonus({ win, lose });
      const evaluation = evaluatePattern(winRate, judged);

      return {
        patternKey,
        total,
        win,
        lose,
        winRate,
        currentBonus: current.bonus,
        recommendedBonus: current.baseBonus,
        confidenceRate: current.confidenceRate,
        evaluation: evaluation.evaluation,
        comment: evaluation.comment,
      };
    });

    const summary = createSummary(reviews);

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V6.1_SELF_REVIEW",
      checked: reviews.length,
      summary,
      reviews,
      updatedAt: new Date().toLocaleString("ja-JP", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("ai power self review error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "AI_POWER_SELF_REVIEW_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}