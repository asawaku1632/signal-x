import { backtestEmaCrossovers } from "./emaCrossoverBacktest.ts";
import type { EmaCandle, EmaClosedTrade } from "./emaCrossoverBacktest.ts";
import { bollingerEntryAllowed } from "./emaSignalComparison.ts";
import {
  EMA_VALIDATION_EPOCH, inPhase, regimeAtBuySignal, studyEmaStock,
} from "./emaRegimeResearch.ts";
import type { EmaStudyInput, EmaStudyPhase } from "./emaRegimeResearch.ts";

/** Fixed rules, not optimized to the current data; signal-bar-only features. */
export const EMA_STAGE5_IDS = ["BASE", "BB", "BB_UP", "BB_UP_HIGH"] as const;
export type EmaStage5Id = typeof EMA_STAGE5_IDS[number];
export const EMA_STAGE5_RULES: Record<EmaStage5Id, { label: string; detail: string }> = {
  BASE: { label: "① EMA単独", detail: "EMA9がEMA21を上抜けで買い、下抜けで売り" },
  BB: { label: "② EMA＋BB", detail: "買い交差当日のBB20中央線以上・上側2σ未満" },
  BB_UP: { label: "③ EMA＋BB＋上昇基調", detail: "②に75日平均線の上昇基調を追加" },
  BB_UP_HIGH: { label: "④ EMA＋BB＋上昇＋高ボラ", detail: "③に20日変動率標準偏差2%以上を追加" },
};

export type TaggedTrade = EmaClosedTrade & { code: string };
export type Stage5Stock = {
  code: string;
  reason: string | null;
  barCount: number;
  splitEvents: number;
  trades: Record<EmaStage5Id, TaggedTrade[]>;
  open: Record<EmaStage5Id, boolean>;
};

const noTrades = (): Record<EmaStage5Id, TaggedTrade[]> => ({
  BASE: [], BB: [], BB_UP: [], BB_UP_HIGH: [],
});
const noOpen = (): Record<EmaStage5Id, boolean> => ({
  BASE: false, BB: false, BB_UP: false, BB_UP_HIGH: false,
});
const round = (n: number) => Number(n.toFixed(2));

export function computeStage5Stock(input: EmaStudyInput): Stage5Stock {
  // Reuse the phase-4 data-quality quarantine; do not mix split-affected candles.
  const quality = studyEmaStock(input);
  if (quality.reason) return {
    code: input.code, reason: quality.reason,
    barCount: quality.barCount, splitEvents: quality.splitEventCount,
    trades: noTrades(), open: noOpen(),
  };
  const candles = input.candles;
  // Cache only historical features available by each signal day's close.
  const checked = new Map<number, { bb: boolean; up: boolean; high: boolean }>();
  const feature = (index: number) => {
    const previous = checked.get(index);
    if (previous) return previous;
    const regime = regimeAtBuySignal(candles, index);
    const current = {
      bb: bollingerEntryAllowed(candles, index),
      up: regime.trend === "UP",
      high: regime.volatility === "HIGH",
    };
    checked.set(index, current);
    return current;
  };
  const evaluations = {
    BASE: backtestEmaCrossovers(candles),
    BB: backtestEmaCrossovers(candles, 100, (i) => feature(i).bb),
    BB_UP: backtestEmaCrossovers(candles, 100, (i) => feature(i).bb && feature(i).up),
    BB_UP_HIGH: backtestEmaCrossovers(candles, 100, (i) => feature(i).bb && feature(i).up && feature(i).high),
  };
  return {
    code: input.code, reason: null,
    barCount: candles.length, splitEvents: quality.splitEventCount,
    trades: Object.fromEntries(EMA_STAGE5_IDS.map((id) => [
      id, evaluations[id].trades.map((trade) => ({ ...trade, code: input.code })),
    ])) as Record<EmaStage5Id, TaggedTrade[]>,
    open: Object.fromEntries(EMA_STAGE5_IDS.map((id) => [id, !!evaluations[id].openPosition])) as Record<EmaStage5Id, boolean>,
  };
}

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b);
  const middle = Math.floor(sorted.length/2);
  return round(sorted.length%2===1 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2);
};

/** Closed-trade stats only; realized DD is not portfolio mark-to-market risk. */
export function riskStatistics(trades: TaggedTrade[]) {
  const ordered = [...trades].sort((a,b)=>a.exitTime-b.exitTime || a.code.localeCompare(b.code));
  const count = trades.length, wins = trades.filter((t)=>t.pnlYen>0).length;
  const losses = trades.filter((t)=>t.pnlYen<0).length;
  const grossGain = trades.reduce((s,t)=>s+Math.max(0,t.pnlYen),0);
  const grossLoss = trades.reduce((s,t)=>s+Math.max(0,-t.pnlYen),0);
  let cumulative=0, peak=0, maxRealizedDrawdown=0, streak=0, longestLosingStreak=0;
  for(const trade of ordered) {
    cumulative += trade.pnlYen;
    peak = Math.max(peak,cumulative);
    maxRealizedDrawdown=Math.max(maxRealizedDrawdown, peak-cumulative);
    streak = trade.pnlYen < 0 ? streak+1 : 0;
    longestLosingStreak=Math.max(longestLosingStreak,streak);
  }
  return {
    trades:count,wins,losses,flats:count-wins-losses,
    winRatePercent:count?round(100*wins/count):null,
    totalPnlYen:round(grossGain-grossLoss),
    avgPnlYen:count?round((grossGain-grossLoss)/count):null,
    avgReturnPercent:count?round(trades.reduce((s,t)=>s+t.returnPercent,0)/count):null,
    medianReturnPercent:median(trades.map((t)=>t.returnPercent)),
    medianPnlYen:median(trades.map((t)=>t.pnlYen)),
    worstTradeYen:count?Math.min(...trades.map((t)=>t.pnlYen)):null,
    bestTradeYen:count?Math.max(...trades.map((t)=>t.pnlYen)):null,
    grossGainYen:round(grossGain), grossLossYen:round(grossLoss),
    // No losses ⇒ undefined ratio, not a falsely "perfect" score.
    profitFactor:grossLoss>0?round(grossGain/grossLoss):null,
    maxRealizedDrawdownYen:round(maxRealizedDrawdown),
    longestLosingStreak,
  };
}

export function stage5PhaseSummary(stocks:Stage5Stock[], phase:EmaStudyPhase) {
  const eligible=stocks.filter((stock)=>!stock.reason);
  return Object.fromEntries(EMA_STAGE5_IDS.map((id)=>{
    const selected = eligible.flatMap((stock)=>stock.trades[id].filter((t)=>inPhase(t,phase)));
    const metrics = riskStatistics(selected);
    const byStock = eligible.map((stock)=>({
      code:stock.code,
      risk:riskStatistics(stock.trades[id].filter((t)=>inPhase(t,phase))),
    }));
    const ranked = [...byStock].filter((row)=>row.risk.trades>0)
      .sort((a,b)=>b.risk.totalPnlYen-a.risk.totalPnlYen);
    const top = ranked[0]??null;
    return [id, {
      metrics, byStock,
      highestProfitStock:top?.code??null,
      highestProfitYen:top?.risk.totalPnlYen??null,
      excludingHighestProfitYen:top ? round(metrics.totalPnlYen-top.risk.totalPnlYen):null,
      eligibleStocks:eligible.length,
      tradedStocks:byStock.filter((row)=>row.risk.trades>0).length,
    }];
  })) as Record<EmaStage5Id, {
    metrics:ReturnType<typeof riskStatistics>;
    byStock:Array<{code:string;risk:ReturnType<typeof riskStatistics>}>;
    highestProfitStock:string|null;
    highestProfitYen:number|null;
    excludingHighestProfitYen:number|null;
    eligibleStocks:number;
    tradedStocks:number;
  }>;
}

export function stage5Summary(inputs:EmaStudyInput[]) {
  const stocks=inputs.map(computeStage5Stock);
  const phases = {
    ALL:stage5PhaseSummary(stocks,"ALL"),
    TRAIN:stage5PhaseSummary(stocks,"TRAIN"),
    TEST:stage5PhaseSummary(stocks,"TEST"),
  };
  const boundaryExcluded = Object.fromEntries(EMA_STAGE5_IDS.map((id)=>[id,
    stocks.filter((s)=>!s.reason).reduce((sum,stock)=>sum+stock.trades[id].filter((t)=>
      !inPhase(t,"TRAIN") && !inPhase(t,"TEST")).length,0),
  ])) as Record<EmaStage5Id,number>;
  return {
    stocks, phases, boundaryExcluded,
    eligible:stocks.filter((s)=>!s.reason).length,
    excluded:stocks.filter((s)=>!!s.reason).length,
    cutDate:EMA_VALIDATION_EPOCH,
  };
}
