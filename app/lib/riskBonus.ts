export function calculateRiskScore(params: {
  aiPower: number;
  changePercent: number;
  volatility: number;
}) {
  const { aiPower, changePercent, volatility } = params;

  let riskScore = 50;

  if (aiPower >= 85) riskScore -= 15;
  else if (aiPower >= 70) riskScore -= 8;
  else if (aiPower <= 40) riskScore += 15;

  if (changePercent <= -3) riskScore += 20;
  else if (changePercent <= -1.5) riskScore += 10;

  if (changePercent >= 5) riskScore += 10;

  if (volatility >= 8) riskScore += 20;
  else if (volatility >= 5) riskScore += 12;
  else if (volatility >= 3) riskScore += 6;

  return Math.max(0, Math.min(100, Math.round(riskScore)));
}

export function getRiskBonus(riskScore: number) {
  if (riskScore >= 80) return -12;
  if (riskScore >= 65) return -8;
  if (riskScore >= 50) return -3;
  if (riskScore >= 35) return 2;
  return 5;
}