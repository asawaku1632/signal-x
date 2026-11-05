/**
 * Stock win-rate ranking reports two different historical proportions:
 * directional win rate excludes HOLD; +2% occurrence rate includes HOLD.
 * Neither is a forward trading success probability.
 */
export function calculateStockOutcomeRates(win: number, lose: number, hold: number) {
  if (![win, lose, hold].every((count) => Number.isSafeInteger(count) && count >= 0)) {
    throw new Error("Invalid stock outcome count");
  }

  const judged = win + lose;
  const settled = judged + hold;
  const percent = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;

  return {
    judged,
    settled,
    winRate: percent(win, judged),
    winAmongAllRate: percent(win, settled),
  };
}
