/**
 * SHADOW ONLY: On-demand swing research using completed Japanese daily OHLCV.
 * Research hypotheses, NOT institutional order data or reconstructed AI decisions.
 * No network, persistence, scan, notification, or production-scoring dependencies.
 */
export type SwingResearchCandle = {
  time: number; open: number; high: number; low: number; close: number; volume?: number;
};
export type ResearchVariant = "MA525" | "MA525_VOLUME" | "MA525_MSB_OB" | "MA525_ALL";
export const SWING_SHADOW_VERSION = "shadow_msb_ob_ma525_v1" as const;
export const SWING_RESEARCH_VARIANTS: readonly { id: ResearchVariant; label: string; criteria: string }[] = [
  { id: "MA525", label: "① 5日・25日線", criteria: "終値＞5日線＞25日線、25日線が前日より上昇" },
  { id: "MA525_VOLUME", label: "② ①＋出来高", criteria: "①＋当日出来高が直前20本平均の1.5倍以上" },
  { id: "MA525_MSB_OB", label: "③ ①＋MSB/OB反発", criteria: "①＋直近5本以内の上向き構造突破と直前陰線ゾーンへの反発" },
  { id: "MA525_ALL", label: "④ 全条件一致", criteria: "①＋出来高1.5倍以上＋MSB/OB反発" },
];
export type OrderBlockEvidence = {
  breakIndex: number; pivotHigh: number; originIndex: number; zoneLow: number; zoneHigh: number;
};
export type SwingResearchTrade = {
  code: string; signalIndex: number; signalTime: number; entryTime: number; exitTime: number;
  entryPrice: number; exitPrice: number; profitYen100: number; returnPercent: number;
  volumeRatio: number | null; ma5: number; ma25: number; orderBlock: OrderBlockEvidence | null;
  eligible: Record<ResearchVariant, boolean>;
};
export type SwingResearchStats = {
  id: ResearchVariant; label: string; trades: number; excludedFromBase: number;
  wins: number; losses: number; winRatePercent: number | null;
  totalProfitYen100: number; averageProfitYen100: number | null;
  averageReturnPercent: number | null; worstProfitYen100: number | null;
  maxDrawdownYen100: number | null;
};
export type SwingResearchReport = {
  version: typeof SWING_SHADOW_VERSION; cohortCount: number; candleCount: number;
  completedBaseTrades: number; pendingBaseCandidates: number; invalidCodes: string[];
  stats: SwingResearchStats[]; trades: SwingResearchTrade[];
};
const mean = (values: readonly number[]) => values.reduce((sum, n) => sum + n, 0) / values.length;
const round = (number: number) => Math.round(number * 100) / 100;
const positive = (number: number | undefined) => typeof number === "number" && Number.isFinite(number) && number > 0;

/** Invalid/duplicate/out-of-order bars must fail closed, not silently be reordered. */
export function validDailyResearchCandles(bars: readonly SwingResearchCandle[]): boolean {
  return bars.length >= 31 && bars.every((bar, i) =>
    positive(bar.time) && positive(bar.open) && positive(bar.high) && positive(bar.low) &&
    positive(bar.close) && bar.high >= Math.max(bar.open, bar.close, bar.low) &&
    bar.low <= Math.min(bar.open, bar.close, bar.high) &&
    (bar.volume === undefined || (Number.isFinite(bar.volume) && bar.volume >= 0)) &&
    (i === 0 || bar.time > bars[i - 1].time));
}
function avgClose(bars: readonly SwingResearchCandle[], index: number, period: number) {
  return mean(bars.slice(index - period + 1, index + 1).map(b => b.close));
}
function asOfVolume(bars: readonly SwingResearchCandle[], index: number): number | null {
  const history = bars.slice(index - 20, index).map(b => b.volume);
  const current = bars[index].volume;
  if (history.length !== 20 || !history.every(positive) || !positive(current)) return null;
  return current / mean(history as number[]);
}

/**
 * Previous confirmed pivot highs only (two CLOSED candles to the right).
 * A bullish MSB is a close above the strongest confirmed pivot, after a close
 * below it. This is a chart heuristic, not a record of large orders.
 */
export function findBullishStructureBreak(
  bars: readonly SwingResearchCandle[], index: number,
): OrderBlockEvidence | null {
  if (index < 30 || index >= bars.length || !validDailyResearchCandles(bars.slice(0, index + 1))) return null;
  const pivots: number[] = [];
  for (let k = Math.max(2, index - 45); k <= index - 3; k++) {
    const high = bars[k].high;
    if (high > bars[k - 2].high && high > bars[k - 1].high &&
        high >= bars[k + 1].high && high >= bars[k + 2].high) pivots.push(high);
  }
  if (!pivots.length) return null;
  const pivotHigh = Math.max(...pivots);
  if (bars[index - 1].close > pivotHigh * 1.003 ||
      bars[index].close <= pivotHigh * 1.003 ||
      bars[index].close <= bars[index].open) return null;
  for (let k = index - 1; k >= Math.max(0, index - 10); k--) {
    const origin = bars[k];
    if (origin.close < origin.open && origin.high < bars[index].close) {
      return { breakIndex: index, pivotHigh: round(pivotHigh), originIndex: k,
        zoneLow: round(origin.low), zoneHigh: round(origin.high) };
    }
  }
  return null;
}

/** Revisit of a previously confirmed bearish-candle zone, bullish close back above it. */
export function detectMsbOrderBlockRetest(
  bars: readonly SwingResearchCandle[], index: number,
): OrderBlockEvidence | null {
  if (index < 31 || index >= bars.length || !validDailyResearchCandles(bars.slice(0, index + 1))) return null;
  const today = bars[index];
  if (today.close <= today.open) return null;
  for (let j = index - 1; j >= Math.max(30, index - 5); j--) {
    const ob = findBullishStructureBreak(bars, j);
    if (!ob) continue;
    if (bars.slice(j + 1, index).some(b => b.close < ob.zoneLow)) continue;
    if (today.low <= ob.zoneHigh * 1.005 && today.high >= ob.zoneLow &&
        today.close >= ob.zoneHigh * 1.002) return ob;
  }
  return null;
}
function summarize(id: ResearchVariant, label: string, entries: readonly SwingResearchTrade[]): SwingResearchStats {
  const selected = entries.filter(e => e.eligible[id]).sort((a, b) =>
    a.exitTime - b.exitTime || a.entryTime - b.entryTime || a.code.localeCompare(b.code));
  const pnls = selected.map(e => e.profitYen100);
  const total = pnls.reduce((s, n) => s + n, 0);
  let equity = 0, peak = 0, drawdown = 0;
  for (const pnl of pnls) {
    equity += pnl;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
  }
  const wins = pnls.filter(n => n > 0).length;
  return { id, label, trades: selected.length, excludedFromBase: entries.length - selected.length,
    wins, losses: pnls.length - wins,
    winRatePercent: pnls.length ? round(100 * wins / pnls.length) : null,
    totalProfitYen100: total, averageProfitYen100: pnls.length ? Math.round(total / pnls.length) : null,
    averageReturnPercent: pnls.length ? round(mean(selected.map(e => e.returnPercent))) : null,
    worstProfitYen100: pnls.length ? Math.min(...pnls) : null,
    maxDrawdownYen100: pnls.length ? drawdown : null };
}

/**
 * Every MA-valid daily close is one observation. Five-day holding windows can
 * overlap, so samples are correlated and NOT a portfolio backtest.
 * Same hypothetical fills across all four variants.
 * Signal at completed close i, enter at next OPEN, leave at close i+5.
 * Slippage 0.1% each way; 100 shares; no commissions, tax, dividends or splits.
 * Only completed 5-day outcomes appear in win rates; future bars are never read
 * when deciding variant eligibility.
 */
export function studyMsbMaSwing(
  cohorts: readonly { code: string; candles: readonly SwingResearchCandle[] }[],
): SwingResearchReport {
  const trades: SwingResearchTrade[] = [];
  const invalidCodes: string[] = [];
  let candleCount = 0, pendingBaseCandidates = 0, cohortCount = 0;
  for (const { code, candles } of cohorts) {
    if (!/^[0-9]{4}$/.test(code) || !validDailyResearchCandles(candles)) {
      invalidCodes.push(code); continue;
    }
    cohortCount++;
    candleCount += candles.length;
    for (let i = 30; i < candles.length; i++) {
      const ma5 = avgClose(candles, i, 5);
      const ma25 = avgClose(candles, i, 25);
      const prior25 = avgClose(candles, i - 1, 25);
      const base = candles[i].close > ma5 && ma5 > ma25 && ma25 > prior25;
      if (!base) continue;
      if (i + 5 >= candles.length) { pendingBaseCandidates++; continue; }
      const ratio = asOfVolume(candles, i);
      const ob = detectMsbOrderBlockRetest(candles, i);
      const volume = ratio !== null && ratio >= 1.5;
      const entry = candles[i + 1].open * 1.001;
      const exit = candles[i + 5].close * 0.999;
      const profit = (exit - entry) * 100;
      trades.push({
        code, signalIndex: i, signalTime: candles[i].time,
        entryTime: candles[i + 1].time, exitTime: candles[i + 5].time,
        entryPrice: round(entry), exitPrice: round(exit),
        profitYen100: Math.round(profit), returnPercent: round(100 * (exit / entry - 1)),
        volumeRatio: ratio === null ? null : round(ratio), ma5: round(ma5), ma25: round(ma25),
        orderBlock: ob,
        eligible: { MA525: true, MA525_VOLUME: volume, MA525_MSB_OB: ob !== null,
          MA525_ALL: volume && ob !== null },
      });
    }
  }
  return { version: SWING_SHADOW_VERSION, cohortCount, candleCount,
    completedBaseTrades: trades.length, pendingBaseCandidates, invalidCodes,
    stats: SWING_RESEARCH_VARIANTS.map(v => summarize(v.id, v.label, trades)),
    trades: trades.sort((a, b) => b.signalTime - a.signalTime || a.code.localeCompare(b.code)) };
}
