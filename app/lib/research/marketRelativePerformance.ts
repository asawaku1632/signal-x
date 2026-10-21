import type { BenchmarkWindow } from "./marketIndexBenchmarkWindow";
import type { MarketIndexKey } from "./marketIndexShadowContract";

export type ValidatedReturn = {
  status: "comparable";
  fromDate: string;
  toDate: string;
  window: BenchmarkWindow;
  changePct: number;
};
export type IndexReturn = ValidatedReturn & { index: MarketIndexKey };
export type StockReturn = ValidatedReturn & { stockCode: string };

/** Percentage-point outperformance; research only, not a trading signal. */
export function calculateMarketRelativePerformance(stock: StockReturn, market: IndexReturn) {
  if (stock.status !== "comparable" || market.status !== "comparable" ||
      stock.fromDate !== market.fromDate || stock.toDate !== market.toDate ||
      stock.window !== market.window)
    return { status: "incompatible" as const, reason: "Different dates or observation windows" };
  if (!/^\d{4}$/.test(stock.stockCode) ||
      !Number.isFinite(stock.changePct) || !Number.isFinite(market.changePct))
    return { status: "invalid" as const, reason: "Invalid stock code or return" };
  const excessReturnPoints = stock.changePct - market.changePct;
  return {
    status: "comparable" as const,
    stockCode: stock.stockCode,
    index: market.index,
    fromDate: stock.fromDate,
    toDate: stock.toDate,
    window: stock.window,
    stockReturnPct: stock.changePct,
    marketReturnPct: market.changePct,
    excessReturnPoints,
    relativeStrength: excessReturnPoints > 0 ? "outperformed" as const :
      excessReturnPoints < 0 ? "underperformed" as const : "matched" as const,
  };
}
