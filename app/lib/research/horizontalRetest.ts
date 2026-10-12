/**
 * Owner-only research: horizontal resistance breakout -> retest -> confirmation.
 * This pure module NEVER changes AI scores, positions, alerts, or learning DB.
 * Hypotheses are NOT calibrated probabilities. Daily, completed OHLCV only.
 */
export type HorizontalCandle = {
  time: number; open: number; high: number; low: number; close: number; volume?: number;
};
export type ResistanceBreak = { index: number; level: number; touches: number; volumeRatio: number | null };
export type HorizontalTrade = {
  breakoutIndex: number; retestIndex: number; entryIndex: number; exitIndex: number;
  resistance: number; touches: number; entry: number; stop: number; target: number;
  exit: number; reason: "STOP" | "TARGET" | "TIME";
  profitYen100: number; returnPercent: number;
};
export type HorizontalStudy = {
  version: string; candleCount: number; breakoutCount: number; retestCount: number;
  unconfirmedCount: number; completed: number; wins: number; losses: number;
  winRatePercent: number | null; profitYen100: number; averageProfitYen100: number | null;
  averageReturnPercent: number | null; maxDrawdownYen100: number;
  trades: HorizontalTrade[];
};
export const HORIZONTAL_RETEST_VERSION = "shadow_horizontal_retest_daily_v1";
const SLIPPAGE = 0.001; // 0.1% assumed on both legs; excludes broker fees/tax.
const pct = (n: number) => Math.round(n * 100) / 100;
const mean = (ns: number[]) => ns.reduce((sum, n) => sum + n, 0) / ns.length;
const finite = (n: number) => Number.isFinite(n) && n > 0;
function valid(c: readonly HorizontalCandle[]): boolean {
  return c.every((b, i) => finite(b.time) && finite(b.open) && finite(b.high) &&
    finite(b.low) && finite(b.close) && b.high >= Math.max(b.open, b.close, b.low) &&
    b.low <= Math.min(b.open, b.close, b.high) && (i === 0 || b.time > c[i - 1].time));
}
function volumeRatio(c: readonly HorizontalCandle[], i: number): number | null {
  const past = c.slice(i - 20, i).map(b => b.volume ?? 0);
  if (past.length < 20 || past.some(v => !finite(v)) || !finite(c[i].volume ?? 0)) return null;
  return (c[i].volume ?? 0) / mean(past);
}
/**
 * Only prior confirmed pivots: peak at k is usable once candles k+1 and k+2
 * have CLOSED, so k <= i-3. No future high/low is read to find a signal.
 */
function resistanceAt(c: readonly HorizontalCandle[], i: number): { price: number; touches: number } | null {
  const groups: Array<{ prices: number[]; indices: number[] }> = [];
  for (let k = Math.max(2, i - 65); k <= i - 3; k++) {
    if (c[k].high < Math.max(c[k-2].high, c[k-1].high, c[k+1].high, c[k+2].high)) continue;
    const p = c[k].high;
    let group = groups.find(g => Math.abs(p / mean(g.prices) - 1) <= .01);
    if (!group) { group = { prices: [], indices: [] }; groups.push(group); }
    // Repeated peaks on adjacent candles do not count as separate rejections.
    if (group.indices.length && k - group.indices[group.indices.length - 1] < 4) continue;
    group.prices.push(p);
    group.indices.push(k);
  }
  const candidates = groups.filter(g => g.indices.length >= 2)
    .map(g => ({ price: mean(g.prices), touches: g.indices.length }))
    .filter(g => c[i-1].close <= g.price * 1.002 &&
      c[i].close >= g.price * 1.004 &&
      c.slice(Math.max(0, i - 8), i).every(b => b.close <= g.price * 1.003));
  candidates.sort((a,b) => b.touches - a.touches || b.price - a.price);
  return candidates[0] ?? null;
}
export function detectHorizontalBreakoutAt(c: readonly HorizontalCandle[], i: number): ResistanceBreak | null {
  if (i < 60 || i >= c.length || !valid(c.slice(0, i + 1))) return null;
  const close20 = mean(c.slice(i - 19, i + 1).map(x => x.close));
  const close50 = mean(c.slice(i - 49, i + 1).map(x => x.close));
  if (!(c[i].close > close20 && close20 > close50)) return null;
  const resistance = resistanceAt(c, i);
  if (!resistance) return null;
  const ratio = volumeRatio(c, i);
  // Missing or thin volume: cannot claim volume-confirmed breakout.
  if (ratio === null || ratio < 1.2) return null;
  return { index: i, level: pct(resistance.price), touches: resistance.touches, volumeRatio: pct(ratio) };
}
function settle(c: readonly HorizontalCandle[], breakout: ResistanceBreak, retestIndex: number):
  HorizontalTrade | null {
  const entryIndex = retestIndex + 1;
  if (entryIndex >= c.length) return null;
  const entry = c[entryIndex].open * (1 + SLIPPAGE);
  const stop = Math.min(breakout.level * .99, c[retestIndex].low * .995);
  const risk = entry - stop;
  if (!(risk > 0) || risk / entry > .08) return null;
  const target = entry + 2 * risk;
  const lastIndex = Math.min(c.length - 1, entryIndex + 4);
  for (let k = entryIndex; k <= lastIndex; k++) {
    const b = c[k];
    let exit: number | null = null;
    let reason: HorizontalTrade["reason"] = "TIME";
    if (b.open <= stop) { exit = b.open; reason = "STOP"; }
    else if (b.low <= stop) { exit = stop; reason = "STOP"; }
    // Conservative: if target and stop were reached in one bar, stop wins.
    else if (b.high >= target) { exit = Math.max(target, b.open); reason = "TARGET"; }
    else if (k === entryIndex + 4) { exit = b.close; reason = "TIME"; }
    if (exit === null) continue;
    const realizedExit = exit * (1 - SLIPPAGE);
    const profit = (realizedExit - entry) * 100;
    return { breakoutIndex: breakout.index, retestIndex, entryIndex,
      exitIndex: k, resistance: breakout.level, touches: breakout.touches,
      entry: pct(entry), stop: pct(stop), target: pct(target), exit: pct(realizedExit),
      reason, profitYen100: Math.round(profit), returnPercent: pct(100 * profit / (entry * 100)) };
  }
  // Insufficient future bars: PENDING, not a loss and not part of win rate.
  return null;
}
export function studyHorizontalRetest(input: readonly HorizontalCandle[]): HorizontalStudy {
  const c = [...input];
  const trades: HorizontalTrade[] = [];
  let breakoutCount = 0, retestCount = 0, unconfirmedCount = 0, lockedUntil = -1;
  if (valid(c)) {
    for (let i = 60; i < c.length - 1; i++) {
      if (i <= lockedUntil) continue;
      const breakout = detectHorizontalBreakoutAt(c, i);
      if (!breakout) continue;
      breakoutCount++;
      let signal: number | null = null;
      for (let j = i + 1; j <= Math.min(i + 5, c.length - 2); j++) {
        const b = c[j];
        // Once decisively below the former ceiling, this candidate is invalid.
        if (b.close < breakout.level * .982) break;
        const near = b.low >= breakout.level * .97 && b.low <= breakout.level * 1.012;
        const bullish = b.close > b.open && b.close >= breakout.level * 1.002;
        if (near && bullish) { signal = j; break; }
      }
      if (signal === null) { unconfirmedCount++; continue; }
      retestCount++;
      const trade = settle(c, breakout, signal);
      if (trade) { trades.push(trade); lockedUntil = trade.exitIndex; }
      // Otherwise there is not enough outcome data; exclude it.
    }
  }
  const wins = trades.filter(t => t.profitYen100 > 0).length;
  const total = trades.reduce((s, t) => s + t.profitYen100, 0);
  let equity = 0, peak = 0, maxDrawdown = 0;
  for (const t of trades) {
    equity += t.profitYen100;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return { version: HORIZONTAL_RETEST_VERSION, candleCount: c.length,
    breakoutCount, retestCount, unconfirmedCount, completed: trades.length,
    wins, losses: trades.length - wins,
    winRatePercent: trades.length ? pct(100 * wins / trades.length) : null,
    profitYen100: total,
    averageProfitYen100: trades.length ? Math.round(total / trades.length) : null,
    averageReturnPercent: trades.length ? pct(mean(trades.map(t => t.returnPercent))) : null,
    maxDrawdownYen100: maxDrawdown,
    trades };
}
