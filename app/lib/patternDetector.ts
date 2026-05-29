export type PatternInput = {
  rsi: number;
  volumeRatio: number;
  breakout: boolean;
  lowerWick: boolean;
  doubleBottom: boolean;
  changeRate: number;
};

export function analyzePattern(input: PatternInput) {
  const {
    rsi,
    volumeRatio,
    breakout,
    lowerWick,
    doubleBottom,
    changeRate,
  } = input;

  let signalScore = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // RSI
  if (rsi >= 60 && rsi <= 85) {
    signalScore += 25;
    reasons.push(`RSI${rsi}`);
  }

  if (rsi >= 86) {
    signalScore -= 25;
    warnings.push("RSI過熱");
  }

  if (rsi <= 35) {
    signalScore -= 20;
    warnings.push("RSI弱い");
  }

  // 出来高
  if (volumeRatio >= 2) {
    signalScore += 30;
    reasons.push(`出来高${volumeRatio}倍`);
  }

  if (volumeRatio >= 4) {
    signalScore += 20;
    reasons.push("資金流入強");
  }

  // ブレイク
  if (breakout) {
    signalScore += 35;
    reasons.push("高値ブレイク");
  }

  // 下ヒゲ
  if (lowerWick) {
    signalScore += 15;
    reasons.push("下ヒゲ反発");
  }

  // ダブルボトム
  if (doubleBottom) {
    signalScore += 20;
    reasons.push("W底形成");
  }

  // 変化率
  if (changeRate >= 1) {
    signalScore += 10;
    reasons.push("上昇中");
  }

  if (changeRate >= 5) {
    signalScore -= 20;
    warnings.push("急騰後の高値掴み注意");
  }

  if (changeRate <= -2) {
    signalScore -= 25;
    warnings.push("下落中");
  }

  // だまし上げ警戒
  if (volumeRatio >= 2 && !breakout) {
    signalScore -= 15;
    warnings.push("出来高だけ増加");
  }

  // 理由が少ない場合は弱くする
  if (reasons.length <= 1) {
    signalScore -= 20;
    warnings.push("根拠不足");
  }

  // 補正
  signalScore = Math.max(0, Math.min(200, signalScore));

  let signal = "監視";
  let notificationLevel = "なし";

  if (signalScore >= 150 && reasons.length >= 3 && warnings.length === 0) {
    signal = "爆上げ予兆";
    notificationLevel = "今すぐ見ろ";
  } else if (signalScore >= 100 && reasons.length >= 2) {
    signal = "強い上昇";
    notificationLevel = "買い候補";
  } else if (signalScore >= 60) {
    signal = "買い候補";
    notificationLevel = "監視";
  }

  return {
    signalScore,
    signal,
    notificationLevel,
    reasons,
    warnings,
    shouldNotify: notificationLevel === "今すぐ見ろ",
  };
}