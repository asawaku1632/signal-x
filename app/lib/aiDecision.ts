export type AiDecisionInput = {
  score: number;
  rsi: number;
  volumeRatio: number;
  changePercent: number;
  learningBonus?: number;
};

export function getAiDecision(input: AiDecisionInput) {
  const { score, rsi, volumeRatio, changePercent, learningBonus = 0 } = input;

  if (score >= 90 && volumeRatio >= 1.5 && learningBonus > 0) {
    return {
      label: "ENTRY ZONE",
      message: "AIはエントリー圏と判断",
      color: "text-purple-400",
      border: "border-purple-500",
    };
  }

  if (score >= 70 && rsi >= 50 && rsi <= 70) {
    return {
      label: "WATCH BUY",
      message: "押し目・継続監視",
      color: "text-red-400",
      border: "border-red-500",
    };
  }

  if (rsi >= 75 || changePercent >= 3) {
    return {
      label: "TAKE PROFIT",
      message: "利確警戒。伸びすぎ注意",
      color: "text-yellow-400",
      border: "border-yellow-500",
    };
  }

  if (score < 50) {
    return {
      label: "NO TOUCH",
      message: "AIは触らない判断",
      color: "text-gray-400",
      border: "border-gray-600",
    };
  }

  return {
    label: "MONITORING",
    message: "様子見。次のシグナル待ち",
    color: "text-cyan-400",
    border: "border-cyan-500",
  };
}