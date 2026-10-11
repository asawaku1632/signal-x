import type { EmaCandle, EmaClosedTrade } from "./emaCrossoverBacktest.ts";
import { compareEmaVariants } from "./emaSignalComparison.ts";
import { EMA_VARIANT_IDS } from "./emaSignalComparison.ts";
import type { EmaVariantId } from "./emaSignalComparison.ts";

export const EMA_VALIDATION_CUTOFF = "2025-10-01";
export const EMA_VALIDATION_EPOCH = Date.parse(EMA_VALIDATION_CUTOFF + "T00:00:00Z") / 1000;
export const EMA_RESEARCH_UNIVERSE = [
  { code: "7203", name: "トヨタ", sector: "自動車" },
  { code: "6758", name: "ソニーG", sector: "電機" },
  { code: "8306", name: "三菱UFJ", sector: "金融" },
  { code: "9984", name: "ソフトバンクG", sector: "通信・投資" },
  { code: "7974", name: "任天堂", sector: "ゲーム" },
  { code: "6861", name: "キーエンス", sector: "電機" },
  { code: "9432", name: "NTT", sector: "通信" },
  { code: "6501", name: "日立", sector: "電機" },
  { code: "8058", name: "三菱商事", sector: "商社" },
  { code: "8035", name: "東京エレクトロン", sector: "半導体" },
  { code: "4063", name: "信越化学", sector: "化学" },
  { code: "4502", name: "武田薬品", sector: "医薬品" },
  { code: "6098", name: "リクルート", sector: "サービス" },
  { code: "6981", name: "村田製作所", sector: "電子部品" },
  { code: "7267", name: "ホンダ", sector: "自動車" },
  { code: "9101", name: "日本郵船", sector: "海運" },
  { code: "8801", name: "三井不動産", sector: "不動産" },
  { code: "4901", name: "富士フイルム", sector: "化学" },
  { code: "8267", name: "イオン", sector: "小売" },
  { code: "8411", name: "みずほFG", sector: "金融" },
  { code: "2914", name: "JT", sector: "食品" },
  { code: "8001", name: "伊藤忠", sector: "商社" },
  { code: "6762", name: "TDK", sector: "電子部品" },
  { code: "8725", name: "MS&AD", sector: "保険" },
  { code: "5803", name: "フジクラ", sector: "非鉄" },
  { code: "8031", name: "三井物産", sector: "商社" },
  { code: "8316", name: "三井住友FG", sector: "金融" },
  { code: "6857", name: "アドバンテスト", sector: "半導体" },
  { code: "6594", name: "ニデック", sector: "精密" },
  { code: "4519", name: "中外製薬", sector: "医薬品" },
  { code: "6902", name: "デンソー", sector: "自動車" },
  { code: "8591", name: "オリックス", sector: "金融" },
  { code: "6367", name: "ダイキン", sector: "機械" },
  { code: "7011", name: "三菱重工", sector: "機械" },
  { code: "6702", name: "富士通", sector: "IT" },
  { code: "3402", name: "東レ", sector: "素材" },
  { code: "5401", name: "日本製鉄", sector: "鉄鋼" },
  { code: "9503", name: "関西電力", sector: "電力" },
  { code: "9020", name: "JR東日本", sector: "鉄道" },
  { code: "2502", name: "アサヒG", sector: "食品" },
] as const;

export type RegimeLabel = "UP" | "DOWN" | "SIDEWAYS" | "UNKNOWN";
export type VolatilityLabel = "HIGH" | "LOW" | "UNKNOWN";
export type EmaStudyPhase = "ALL" | "TRAIN" | "TEST";
export type EmaStudyInput = { code: string; candles: EmaCandle[]; splitEvents?: number[] };

export type EmaStudyResult = {
  code: string;
  barCount: number;
  reason: string | null;
  splitEventCount: number;
  trades: Record<EmaVariantId, EmaClosedTrade[]>;
  openPositions: Record<EmaVariantId, boolean>;
  riskGaps: number;
};
export type EmaTradeMetric = {
  trades: number;
  wins: number;
  losses: number;
  pnlYen: number;
  averageReturnPercent: number | null;
  winRatePercent: number | null;
  avgPnlYen: number | null;
  worstYen: number | null;
};

export function metric(trades: EmaClosedTrade[]): EmaTradeMetric {
  const wins = trades.filter((t) => t.pnlYen > 0).length;
  const losses = trades.filter((t) => t.pnlYen < 0).length;
  const n = trades.length;
  const pnl = trades.reduce((s, t) => s + t.pnlYen, 0);
  return {
    trades: n, wins, losses,
    pnlYen: Number(pnl.toFixed(2)),
    averageReturnPercent: n ? Number((trades.reduce((s, t) => s + t.returnPercent, 0) / n).toFixed(2)) : null,
    winRatePercent: n ? Number((wins * 100 / n).toFixed(1)) : null,
    avgPnlYen: n ? Number((pnl / n).toFixed(2)) : null,
    worstYen: n ? Math.min(...trades.map((t) => t.pnlYen)) : null,
  };
}

/** Train exits strictly before split, TEST entries on/after split.
 * Trades crossing the boundary do NOT belong to either partition. */
export function inPhase(trade: EmaClosedTrade, phase: EmaStudyPhase) {
  return phase === "ALL" ||
    (phase === "TRAIN" && trade.exitTime < EMA_VALIDATION_EPOCH) ||
    (phase === "TEST" && trade.entryTime >= EMA_VALIDATION_EPOCH);
}

export function gapAnomalies(candles: EmaCandle[]): number {
  let gaps = 0;
  for (let i = 1; i < candles.length; i++) {
    const previous = candles[i - 1].close;
    const current = candles[i].open;
    if (!(previous > 0 && current > 0)) return gaps + 1;
    const ratio = current / previous;
    // Conservative quarantine for apparent splits / non-trading corporate events.
    if (ratio < 0.67 || ratio > 1.5) gaps++;
  }
  return gaps;
}

export function studyEmaStock(input: EmaStudyInput): EmaStudyResult {
  const { code, candles } = input;
  const first = candles[0]?.time ?? Infinity;
  const last = candles.at(-1)?.time ?? -Infinity;
  const events = (input.splitEvents ?? []).filter((epoch) => Number.isFinite(epoch) && epoch >= first && epoch <= last);
  const riskGaps = gapAnomalies(candles);
  const badBars = candles.some((c, i) =>
    !Number.isFinite(c.time) || !Number.isFinite(c.open) || !Number.isFinite(c.close) ||
    c.open <= 0 || c.close <= 0 || (i > 0 && c.time <= candles[i - 1].time));
  const reason = candles.length < 110 ? "日足不足（110本未満）" :
    badBars ? "欠損・並び順異常" :
    events.length > 0 ? "株式分割の記録あり：調整価格の検証待ち" :
    riskGaps > 0 ? "大幅ギャップあり：分割等の確認待ち" : null;
  const result = reason ? null : compareEmaVariants(candles);
  return {
    code, barCount: candles.length, reason,
    splitEventCount: events.length, riskGaps,
    trades: result ? Object.fromEntries(EMA_VARIANT_IDS.map((id) => [id, result[id].trades])) as Record<EmaVariantId, EmaClosedTrade[]> :
      { BASE: [], VOLUME: [], BOLLINGER: [] },
    openPositions: result ? Object.fromEntries(EMA_VARIANT_IDS.map((id) => [id, !!result[id].openPosition])) as Record<EmaVariantId, boolean> :
      { BASE: false, VOLUME: false, BOLLINGER: false },
  };
}

/** Every feature below uses the BUY SIGNAL bar and earlier candles only. */
export function regimeAtBuySignal(candles: EmaCandle[], signalIndex: number): {
  trend: RegimeLabel;
  volatility: VolatilityLabel;
} {
  if (!Number.isInteger(signalIndex) || signalIndex < 0 || signalIndex >= candles.length) {
    return { trend: "UNKNOWN", volatility: "UNKNOWN" };
  }
  let trend: RegimeLabel = "UNKNOWN";
  if (signalIndex >= 79) {
    const ma = (end: number) => candles.slice(end - 74, end + 1).reduce((s, bar) => s + bar.close, 0) / 75;
    const current = ma(signalIndex);
    const fiveAgo = ma(signalIndex - 5);
    const close = candles[signalIndex].close;
    trend = close > current && current > fiveAgo ? "UP"
      : close < current && current < fiveAgo ? "DOWN" : "SIDEWAYS";
  }
  let volatility: VolatilityLabel = "UNKNOWN";
  if (signalIndex >= 20) {
    const changes = candles.slice(signalIndex - 20, signalIndex + 1);
    const returns = changes.slice(1).map((bar, i) => bar.close / changes[i].close - 1);
    if (returns.every((n) => Number.isFinite(n))) {
      const mean = returns.reduce((s, n) => s + n, 0) / returns.length;
      const std = Math.sqrt(returns.reduce((s, n) => s + (n - mean) ** 2, 0) / returns.length);
      volatility = std >= 0.02 ? "HIGH" : "LOW";
    }
  }
  return { trend, volatility };
}

export function bucketBaselineRegimes(data: Array<{ candles: EmaCandle[]; study: EmaStudyResult }>, phase: EmaStudyPhase) {
  const grouped: Record<"trend" | "volatility", Record<string, EmaClosedTrade[]>> = {
    trend: { UP: [], DOWN: [], SIDEWAYS: [], UNKNOWN: [] },
    volatility: { HIGH: [], LOW: [], UNKNOWN: [] },
  };
  for (const { candles, study } of data) {
    if (study.reason) continue;
    const indexByTime = new Map(candles.map((bar, index) => [bar.time, index]));
    for (const trade of study.trades.BASE) {
      if (!inPhase(trade, phase)) continue;
      const signalIndex = indexByTime.get(trade.buySignalTime);
      if (signalIndex === undefined) continue;
      const labels = regimeAtBuySignal(candles, signalIndex);
      grouped.trend[labels.trend].push(trade);
      grouped.volatility[labels.volatility].push(trade);
    }
  }
  return {
    trend: Object.fromEntries(Object.entries(grouped.trend).map(([key, trades]) => [key, metric(trades)])) as Record<RegimeLabel, EmaTradeMetric>,
    volatility: Object.fromEntries(Object.entries(grouped.volatility).map(([key, trades]) => [key, metric(trades)])) as Record<VolatilityLabel, EmaTradeMetric>,
  };
}

export function summarizeEmaResearch(inputs: EmaStudyInput[]) {
  const stocks = inputs.map((input) => studyEmaStock(input));
  const eligible = stocks.filter((study) => study.reason === null);
  const byStock = new Map(inputs.map((input) => [input.code, input.candles]));
  const phase = (part: EmaStudyPhase) => Object.fromEntries(EMA_VARIANT_IDS.map((id) => [
    id,
    metric(eligible.flatMap((study) => study.trades[id].filter((trade) => inPhase(trade, part)))),
  ])) as Record<EmaVariantId, EmaTradeMetric>;

  const all = phase("ALL"), train = phase("TRAIN"), test = phase("TEST");
  const positiveStocks = eligible.map((study) => ({
    code: study.code, pnl: metric(study.trades.BASE).pnlYen,
  })).sort((a, b) => b.pnl - a.pnl);
  const top = positiveStocks[0] ?? null;
  const topMinus = all.BASE.pnlYen - (top?.pnl ?? 0);
  const baselineAcrossBoundary = eligible.reduce((sum, study) =>
    sum + study.trades.BASE.filter((trade) => !inPhase(trade, "TRAIN") && !inPhase(trade, "TEST")).length, 0);
  const grouped = eligible.map((study) => ({ study, candles: byStock.get(study.code) ?? [] }));
  return {
    stocks, excludedCount: stocks.length - eligible.length, eligibleCount: eligible.length,
    all, train, test,
    regimesTrain: bucketBaselineRegimes(grouped, "TRAIN"),
    regimesTest: bucketBaselineRegimes(grouped, "TEST"),
    regimesAll: bucketBaselineRegimes(grouped, "ALL"),
    topStock: top,
    profitExcludingTopYen: Number(topMinus.toFixed(2)),
    baselineAcrossBoundary,
  };
}
