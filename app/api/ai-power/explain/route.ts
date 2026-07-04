import { NextResponse } from "next/server";

function buildExplanation(item: {
  patternKey: string;
  recommendedBonus: number;
  winRate: number;
  sampleCount: number;
  evaluation: string;
}) {
  const { patternKey, recommendedBonus, winRate, sampleCount, evaluation } =
    item;

  let strengthText = "中立的な状態です。";
  let reasonText = "現時点では大きな補正をかけるほどの根拠はありません。";

  if (evaluation === "STRONG_BUY") {
    strengthText = "非常に強い買い寄りのパターンです。";
    reasonText = `勝率${winRate}%と高く、サンプル数も${sampleCount}件あるため、AIは強いプラス補正を提案しました。`;
  } else if (evaluation === "AVOID") {
    strengthText = "注意が必要な避けたいパターンです。";
    reasonText = `勝率${winRate}%と低いため、AIはマイナス補正を提案しました。`;
  } else if (evaluation === "KEEP") {
    strengthText = "現状維持が妥当なパターンです。";
    reasonText = `勝率${winRate}%で、強く上げるにも下げるにも根拠が弱いため、AIは補正変更を見送りました。`;
  } else if (evaluation === "NOT_ENOUGH_DATA") {
    strengthText = "まだ判断材料が不足しています。";
    reasonText = `サンプル数が${sampleCount}件のため、AIは補正を保留しました。`;
  }

  const bonusText =
    recommendedBonus > 0
      ? `+${recommendedBonus}`
      : String(recommendedBonus);

  return `${patternKey} は、${strengthText}

${reasonText}

今回のAI提案は ${bonusText} 点です。

この判断は、過去の学習データに基づいています。`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const patternKey = url.searchParams.get("patternKey") ?? "";
    const recommendedBonus = Number(url.searchParams.get("recommendedBonus") ?? 0);
    const winRate = Number(url.searchParams.get("winRate") ?? 0);
    const sampleCount = Number(url.searchParams.get("sampleCount") ?? 0);
    const evaluation = url.searchParams.get("evaluation") ?? "KEEP";

    const explanation = buildExplanation({
      patternKey,
      recommendedBonus,
      winRate,
      sampleCount,
      evaluation,
    });

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V12.3_EXPLAINABLE_AI",
      patternKey,
      recommendedBonus,
      winRate,
      sampleCount,
      evaluation,
      explanation,
    });
  } catch (error) {
    console.error("AI explanation error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}