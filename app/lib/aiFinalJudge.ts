export type AiFinalJudgeInput = {
  score: number;
  rsi: number;
  volumeRatio: number;
  changePercent: number;
  learningBonus?: number;
  reason?: string;
};

export type AiFinalJudgeResult = {
  label:
    | "大本命"
    | "本命"
    | "無理に入るな"
    | "静観"
    | "危険"
    | "今すぐ撤退";

  title: string;
  message: string;
  reasons: string[];
  color: string;
  border: string;
  bg: string;
};

export function getAiFinalJudge(
  input: AiFinalJudgeInput
): AiFinalJudgeResult {
  const {
    score,
    rsi,
    volumeRatio,
    changePercent,
    learningBonus = 0,
    reason = "",
  } = input;

  const reasons: string[] = [];

  if (score >= 90) reasons.push("AI POWERが90以上");
  if (score >= 75) reasons.push("AIが強い上昇を検知");
  if (rsi >= 50 && rsi <= 70)
    reasons.push("RSIが良好ゾーン");
  if (rsi >= 75)
    reasons.push("RSIが過熱気味");
  if (volumeRatio >= 2)
    reasons.push("出来高急増");
  if (changePercent >= 3)
    reasons.push("短期急上昇");
  if (learningBonus > 0)
    reasons.push(`AI学習補正 +${learningBonus}`);
  if (reason)
    reasons.push(reason);

  // 大本命
  if (
    score >= 90 &&
    volumeRatio >= 1.5 &&
    learningBonus > 0 &&
    rsi <= 75
  ) {
    return {
      label: "大本命",
      title: "AI最強クラス",
      message:
        "複数条件一致。AIはかなり強い上昇期待と判断。",
      reasons,
      color: "text-purple-300",
      border: "border-purple-500",
      bg: "bg-purple-950/50",
    };
  }

  // 本命
  if (
    score >= 75 &&
    rsi >= 45 &&
    rsi <= 75
  ) {
    return {
      label: "本命",
      title: "強い候補",
      message:
        "AIは有力候補と判断。タイミング監視。",
      reasons,
      color: "text-red-300",
      border: "border-red-500",
      bg: "bg-red-950/40",
    };
  }

  // 無理に入るな
  if (
    score >= 55
  ) {
    return {
      label: "無理に入るな",
      title: "焦る場面ではない",
      message:
        "まだ形が弱い。飛び乗り注意。",
      reasons,
      color: "text-cyan-300",
      border: "border-cyan-500",
      bg: "bg-cyan-950/30",
    };
  }

  // 静観
  if (
    score >= 40
  ) {
    return {
      label: "静観",
      title: "方向感なし",
      message:
        "AIは様子見を推奨。",
      reasons,
      color: "text-blue-300",
      border: "border-blue-500",
      bg: "bg-blue-950/30",
    };
  }

  // 危険
  if (
    score >= 25
  ) {
    return {
      label: "危険",
      title: "リスク高め",
      message:
        "急落や不安定な動きに警戒。",
      reasons,
      color: "text-yellow-300",
      border: "border-yellow-500",
      bg: "bg-yellow-950/30",
    };
  }

  // 今すぐ撤退
  return {
    label: "今すぐ撤退",
    title: "AI緊急警告",
    message:
      "AIは撤退を推奨。無理な保持は危険。",
    reasons,
    color: "text-gray-300",
    border: "border-gray-600",
    bg: "bg-zinc-900",
  };
}