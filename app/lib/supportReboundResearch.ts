/**
 * SHADOW ONLY: compares the support rebound hint (③) with later confirmation (②).
 * Uses past daily candles only. Hypothetical entry/exit at the NEXT session open.
 */
export type ReboundCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export type ReboundTrade = {
  signalIndex: number; signalTime: number; entryTime: number; exitTime: number;
  entryPrice: number; exitPrice: number; returnPercent: number;
  pnlYen: number; worstIntratradePercent: number;
};
export type ReboundOpportunity = {
  hintIndex: number; hintTime: number; support: number;
  confirmedTime: number | null; hintTrade: ReboundTrade | null; confirmedTrade: ReboundTrade | null;
};
export type ReboundStats = {
  count: number; wins: number; winRatePercent: number | null;
  averageReturnPercent: number | null; totalPnlYen: number;
  worstReturnPercent: number | null; averageWorstIntratradePercent: number | null;
};
export type ReboundStudy = {
  opportunities: ReboundOpportunity[];
  hints: ReboundStats; confirmations: ReboundStats;
  hintCount: number; confirmedCount: number;
  pendingHintOutcomes: number; pendingConfirmedOutcomes: number;
  paired: {
    count: number; hint: ReboundStats; confirmation: ReboundStats;
    confirmationBetter: number; avgReturnDifferencePoints: number | null;
  };
};
const round = (n: number) => Number(n.toFixed(2));

function trade(candles: ReboundCandle[], signalIndex: number, holdBars: number, shares: number): ReboundTrade | null {
  const entryIndex = signalIndex + 1, exitIndex = entryIndex + holdBars;
  if (exitIndex >= candles.length) return null;
  const entry = candles[entryIndex], exit = candles[exitIndex];
  if (!(entry.open > 0 && exit.open > 0)) return null;
  const worstLow = Math.min(...candles.slice(entryIndex, exitIndex).map((c) => c.low));
  return {
    signalIndex, signalTime: candles[signalIndex].time,
    entryTime: entry.time, exitTime: exit.time,
    entryPrice: entry.open, exitPrice: exit.open,
    returnPercent: round(100 * (exit.open / entry.open - 1)),
    pnlYen: round((exit.open - entry.open) * shares),
    worstIntratradePercent: round(100 * (worstLow / entry.open - 1)),
  };
}
function stats(trades: ReboundTrade[]): ReboundStats {
  const count = trades.length, wins = trades.filter((t) => t.pnlYen > 0).length;
  return {
    count, wins, winRatePercent: count ? round(100 * wins / count) : null,
    averageReturnPercent: count ? round(trades.reduce((sum, t) => sum + t.returnPercent, 0) / count) : null,
    totalPnlYen: round(trades.reduce((sum, t) => sum + t.pnlYen, 0)),
    worstReturnPercent: count ? Math.min(...trades.map((t) => t.returnPercent)) : null,
    averageWorstIntratradePercent: count ? round(trades.reduce((sum, t) => sum + t.worstIntratradePercent, 0) / count) : null,
  };
}

/** Previous 20-session low (no future leakage), 3 falling closes, small green bar near support. */
function isHint(candles: ReboundCandle[], i: number): number | null {
  const candle = candles[i];
  if (!(candles[i - 3].close > candles[i - 2].close && candles[i - 2].close > candles[i - 1].close)) return null;
  const support = Math.min(...candles.slice(i - 20, i).map((c) => c.low));
  const range = candle.high - candle.low, body = candle.close - candle.open;
  if (!(range > 0 && body > 0) || body / range > 0.5 ||
    candle.low < support * 0.98 || candle.low > support * 1.02 ||
    candle.close < support * 0.99) return null;
  return support;
}

/** 2 consecutive rising green bars within 3 sessions, without breaking support. */
function confirmIndex(candles: ReboundCandle[], hintIndex: number, support: number): number | null {
  for (let j = hintIndex + 1; j <= Math.min(hintIndex + 3, candles.length - 1); j++) {
    const previous = candles[j - 1], bar = candles[j];
    if (bar.close < support * 0.99) break;
    if (bar.close > bar.open && previous.close > previous.open &&
        bar.close > previous.close && bar.close > candles[hintIndex].close) return j;
  }
  return null;
}
function splitInWindow(candles: ReboundCandle[], first: number, last: number, splitEvents: number[]): boolean {
  return splitEvents.some((event) => event >= candles[first].time && event <= candles[last].time);
}

export function studySupportRebounds(
  candles: ReboundCandle[],
  { holdBars = 5, shares = 100, splitEvents = [] }: { holdBars?: number; shares?: number; splitEvents?: number[] } = {},
): ReboundStudy {
  if (!Number.isSafeInteger(holdBars) || holdBars < 1 || holdBars > 20) throw new Error("INVALID_HOLD_BARS");
  if (!Number.isSafeInteger(shares) || shares < 1) throw new Error("INVALID_SHARES");
  const opportunities: ReboundOpportunity[] = [];
  let lastHintIndex = -5;
  for (let i = 20; i < candles.length; i++) {
    if (i - lastHintIndex < 5) continue; // avoid overlapping setups in the same 5-session cluster
    const support = isHint(candles, i);
    if (support === null) continue;
    const confirmationIndex = confirmIndex(candles, i, support);
    const lastNeeded = Math.min(candles.length - 1, (confirmationIndex ?? i) + 1 + holdBars);
    if (splitInWindow(candles, i - 20, lastNeeded, splitEvents)) continue;
    const hintTrade = trade(candles, i, holdBars, shares);
    const confirmedTrade = confirmationIndex === null ? null : trade(candles, confirmationIndex, holdBars, shares);
    opportunities.push({
      hintIndex: i, hintTime: candles[i].time, support,
      confirmedTime: confirmationIndex === null ? null : candles[confirmationIndex].time,
      hintTrade, confirmedTrade,
    });
    lastHintIndex = i;
  }
  const hints = opportunities.flatMap((o) => o.hintTrade ? [o.hintTrade] : []);
  const confirmed = opportunities.flatMap((o) => o.confirmedTrade ? [o.confirmedTrade] : []);
  const paired = opportunities.filter((o) => o.hintTrade && o.confirmedTrade);
  return {
    opportunities, hints: stats(hints), confirmations: stats(confirmed),
    hintCount: opportunities.length,
    confirmedCount: opportunities.filter((o) => o.confirmedTime !== null).length,
    pendingHintOutcomes: opportunities.filter((o) => !o.hintTrade).length,
    pendingConfirmedOutcomes: opportunities.filter((o) => o.confirmedTime !== null && !o.confirmedTrade).length,
    paired: {
      count: paired.length,
      hint: stats(paired.flatMap((o) => o.hintTrade ? [o.hintTrade] : [])),
      confirmation: stats(paired.flatMap((o) => o.confirmedTrade ? [o.confirmedTrade] : [])),
      confirmationBetter: paired.filter((o) => o.confirmedTrade!.returnPercent > o.hintTrade!.returnPercent).length,
      avgReturnDifferencePoints: paired.length
        ? round(paired.reduce((sum, o) => sum + o.confirmedTrade!.returnPercent - o.hintTrade!.returnPercent, 0) / paired.length) : null,
    },
  };
}
