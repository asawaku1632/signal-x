export function getVolatilityBonus(volatility: number) {
  if (volatility >= 8) return -4;
  if (volatility >= 5) return -2;
  if (volatility >= 3) return 1;
  return 3;
}