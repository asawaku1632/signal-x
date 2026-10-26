export type RealizedResult = { profitYen: number };
export function summarizeRealizedResults(items: readonly RealizedResult[]) {
  if (items.some(item => !Number.isFinite(item.profitYen))) throw new RangeError("profitYen");
  const wins = items.filter(item => item.profitYen > 0);
  const losses = items.filter(item => item.profitYen < 0);
  const total = items.reduce((sum, item) => sum + item.profitYen, 0);
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const item of items) {
    running += item.profitYen;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
  }
  return {
    count: items.length,
    wins: wins.length,
    losses: losses.length,
    winRate: items.length ? wins.length / items.length * 100 : null,
    averageWin: wins.length ? wins.reduce((s, x) => s + x.profitYen, 0) / wins.length : null,
    averageLoss: losses.length ? losses.reduce((s, x) => s + x.profitYen, 0) / losses.length : null,
    expectancy: items.length ? total / items.length : null,
    total,
    maxDrawdown,
    insufficientSample: items.length < 30,
  };
}
