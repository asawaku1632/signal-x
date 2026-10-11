import { calculateEmaSeries } from "./technicalIndicatorMath.ts";

/**
 * Read-only, historical EMA crossing study. No order execution and no storage.
 * Signal detection uses confirmed close; hypothetical execution uses NEXT bar's open.
 */
export type EmaCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type EmaCrossoverSignal = {
  index: number;
  time: number;
  kind: "BUY" | "SELL";
  close: number;
};
export type EmaClosedTrade = {
  buySignalTime: number;
  entryTime: number;
  sellSignalTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  pnlYen: number;
  returnPercent: number;
  holdBars: number;
};
type OpenPosition = {
  buySignalTime: number;
  entryTime: number;
  entryPrice: number;
  entryIndex: number;
};
const rounded = (n: number) => Number(n.toFixed(2));

export function analyzeEmaCrossovers(candles: EmaCandle[]) {
  const closes = candles.map((c) => c.close);
  const ema9 = calculateEmaSeries(closes, 9);
  const ema21 = calculateEmaSeries(closes, 21);
  const signals: EmaCrossoverSignal[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const p9 = ema9[i - 1], p21 = ema21[i - 1];
    const n9 = ema9[i], n21 = ema21[i];
    if (p9 === null || p21 === null || n9 === null || n21 === null) continue;
    if (p9 <= p21 && n9 > n21) {
      signals.push({ index: i, time: candles[i].time, kind: "BUY", close: candles[i].close });
    } else if (p9 >= p21 && n9 < n21) {
      signals.push({ index: i, time: candles[i].time, kind: "SELL", close: candles[i].close });
    }
  }
  return { ema9, ema21, signals };
}

export function backtestEmaCrossovers(candles: EmaCandle[], shares = 100, acceptBuySignal?: (signalIndex: number) => boolean) {
  if (!Number.isSafeInteger(shares) || shares <= 0) throw new Error("INVALID_SHARE_COUNT");
  const { signals } = analyzeEmaCrossovers(candles);
  const byIndex = new Map(signals.map((signal) => [signal.index, signal]));
  const trades: EmaClosedTrade[] = [];
  let active: OpenPosition | null = null;
  let pending: EmaCrossoverSignal | null = null;

  for (let i = 0; i < candles.length; i += 1) {
    const bar = candles[i];
    // An after-close crossover is actionable no earlier than the next bar's open.
    if (pending?.kind === "BUY" && !active) {
      active = {
        buySignalTime: pending.time,
        entryTime: bar.time,
        entryPrice: bar.open,
        entryIndex: i,
      };
    } else if (pending?.kind === "SELL" && active) {
      const pnlYen = rounded((bar.open - active.entryPrice) * shares);
      trades.push({
        buySignalTime: active.buySignalTime,
        entryTime: active.entryTime,
        sellSignalTime: pending.time,
        exitTime: bar.time,
        entryPrice: active.entryPrice,
        exitPrice: bar.open,
        shares,
        pnlYen,
        returnPercent: rounded(100 * (bar.open - active.entryPrice) / active.entryPrice),
        holdBars: i - active.entryIndex,
      });
      active = null;
    }
    pending = null;

    const closeSignal = byIndex.get(i);
    if (closeSignal?.kind === "BUY" && !active && (!acceptBuySignal || acceptBuySignal(i))) pending = closeSignal;
    if (closeSignal?.kind === "SELL" && active) pending = closeSignal;
  }

  const wins = trades.filter((trade) => trade.pnlYen > 0).length;
  const losses = trades.filter((trade) => trade.pnlYen < 0).length;
  const flat = trades.length - wins - losses;
  const totalPnlYen = rounded(trades.reduce((sum, trade) => sum + trade.pnlYen, 0));
  let cumulative = 0, peak = 0, maxRealizedDrawdownYen = 0;
  for (const trade of trades) {
    cumulative = rounded(cumulative + trade.pnlYen);
    peak = Math.max(peak, cumulative);
    maxRealizedDrawdownYen = Math.max(maxRealizedDrawdownYen, rounded(peak - cumulative));
  }
  const latest = candles.at(-1);
  const openPosition = active && latest ? {
    buySignalTime: active.buySignalTime,
    entryTime: active.entryTime,
    entryPrice: active.entryPrice,
    latestTime: latest.time,
    latestClose: latest.close,
    unrealizedPnlYen: rounded((latest.close - active.entryPrice) * shares),
    unrealizedReturnPercent: rounded(100 * (latest.close - active.entryPrice) / active.entryPrice),
    exitPending: pending?.kind === "SELL",
  } : null;

  return {
    trades,
    openPosition,
    pendingBuy: pending?.kind === "BUY",
    stats: {
      closedTrades: trades.length,
      wins,
      losses,
      flat,
      winRatePercent: trades.length ? rounded(100 * wins / trades.length) : null,
      totalPnlYen,
      averagePnlYen: trades.length ? rounded(totalPnlYen / trades.length) : null,
      averageReturnPercent: trades.length
        ? rounded(trades.reduce((sum, trade) => sum + trade.returnPercent, 0) / trades.length)
        : null,
      bestTradeYen: trades.length ? Math.max(...trades.map((trade) => trade.pnlYen)) : null,
      worstTradeYen: trades.length ? Math.min(...trades.map((trade) => trade.pnlYen)) : null,
      maxRealizedDrawdownYen,
    },
  };
}
