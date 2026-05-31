type AiWinRateInput = {
  score: number;
  rsi: number;
  volumeRatio: number;
  changePercent: number;
  learningBonus?: number;
};

export function getAiWinRate(input: AiWinRateInput) {
  const { score, rsi, volumeRatio, changePercent, learningBonus = 0 } = input;

  let base = score;

  if (rsi >= 45 && rsi <= 70) base += 5;
  if (rsi > 75) base -= 8;

  if (volumeRatio >= 1.5) base += 5;
  if (volumeRatio >= 2) base += 8;

  if (changePercent >= 0) base += 3;
  if (changePercent >= 5) base -= 5;

  base += learningBonus;

  const win30 = Math.max(30, Math.min(Math.round(base), 95));
  const win60 = Math.max(30, Math.min(Math.round(base - 5), 92));

  return {
    win30,
    win60,
  };
}