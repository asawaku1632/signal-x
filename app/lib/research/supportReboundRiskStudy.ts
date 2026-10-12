import type { ReboundCandle, ReboundTrade, ReboundOpportunity } from "../supportReboundResearch.ts";

/**
 * Read-only, fixed-hypothesis risk study for support rebound hint ③.
 * Every feature is computable at the hint's CLOSE; no future bars are read.
 * Neither historical results nor these thresholds modify production signals.
 */
export const REBOUND_RISK_CUTOFF = Date.parse("2025-10-01T00:00:00Z") / 1000;
export const REBOUND_BAD_LOSS_PERCENT = -5;
export const REBOUND_RISK_RULES = [
  { id: "THIN_VOLUME", label: "出来高が過去20日平均の70%未満", shortLabel: "薄い出来高" },
  { id: "BELOW_SMA50", label: "サイン終値が50日移動平均線より下", shortLabel: "50日線の下" },
  { id: "BELOW_BB_LOWER", label: "サイン終値が20日ボリンジャー -2σより下", shortLabel: "BB下限割れ" },
  { id: "ANY", label: "3条件のどれかに該当（探索用）", shortLabel: "いずれか" },
] as const;
export type RiskRule = (typeof REBOUND_RISK_RULES)[number]["id"];
export type RiskPhase = "ALL" | "TRAIN" | "TEST";
export type ReboundRiskFeatures = {
  volumeRatio: number | null;
  sma50GapPercent: number | null;
  bbLowerGapPercent: number | null;
  thinVolume: boolean | null;
  belowSma50: boolean | null;
  belowBbLower: boolean | null;
};
export type ReboundRiskCase = {
  code: string; hintTime: number; signalIndex: number;
  trade: ReboundTrade | null; features: ReboundRiskFeatures;
};
export type RiskAggregate = {
  count: number; wins: number; majorLosses: number; majorLossRatePercent: number | null;
  winRatePercent: number | null; averageReturnPercent: number | null;
  worstReturnPercent: number | null; totalPnlYen: number;
  intratradeMinus5Count: number;
};
export type RiskRuleResult = {
  rule: RiskRule; phase: RiskPhase; pending: number;
  totalCompleted: number; featureMissing: number;
  eligible: RiskAggregate; rejected: RiskAggregate; retained: RiskAggregate;
  removedMajorLosses: number; removedWinners: number;
};
const round = (x: number): number => Number(x.toFixed(2));
function average(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function series(candles: ReboundCandle[], index: number, length: number): ReboundCandle[] | null {
  if (index - length + 1 < 0 || index >= candles.length || index < 0) return null;
  const data = candles.slice(index - length + 1, index + 1);
  if (data.length !== length || data.some((bar) => !(bar.close > 0 && Number.isFinite(bar.close)))) return null;
  return data;
}

export function inspectReboundHint(
  candles: ReboundCandle[], index: number, splitEvents: number[] = [],
): ReboundRiskFeatures {
  const missing: ReboundRiskFeatures = {
    volumeRatio: null, sma50GapPercent: null, bbLowerGapPercent: null,
    thinVolume: null, belowSma50: null, belowBbLower: null,
  };
  if (!Number.isSafeInteger(index) || index < 0 || index >= candles.length) return missing;
  // A split in the full 50-session feature lookback invalidates all observations.
  const lookbackStart = Math.max(0, index - 49);
  if (splitEvents.some((event) => Number.isFinite(event) && event >= candles[lookbackStart].time && event <= candles[index].time)) return missing;
  const sma50Window = series(candles, index, 50);
  const bb20 = series(candles, index, 20);
  const prevVolume = index >= 20 ? candles.slice(index - 20, index) : [];
  const volumesValid = prevVolume.length === 20 &&
    prevVolume.every((bar) => Number.isFinite(bar.volume) && bar.volume > 0) &&
    Number.isFinite(candles[index].volume) && candles[index].volume > 0;
  const volumeRatio = volumesValid ? candles[index].volume / average(prevVolume.map((bar) => bar.volume)) : null;
  const sma50GapPercent = sma50Window
    ? 100 * (candles[index].close / average(sma50Window.map((bar) => bar.close)) - 1) : null;
  let bbLowerGapPercent: number | null = null;
  if (bb20) {
    const mean = average(bb20.map((bar) => bar.close));
    const variance = average(bb20.map((bar) => (bar.close - mean) ** 2));
    const lower = mean - 2 * Math.sqrt(variance); // population SD, 20 confirmed closes
    if (lower > 0) bbLowerGapPercent = 100 * (candles[index].close / lower - 1);
  }
  return {
    volumeRatio: volumeRatio === null ? null : round(volumeRatio),
    sma50GapPercent: sma50GapPercent === null ? null : round(sma50GapPercent),
    bbLowerGapPercent: bbLowerGapPercent === null ? null : round(bbLowerGapPercent),
    thinVolume: volumeRatio === null ? null : volumeRatio < 0.7,
    belowSma50: sma50GapPercent === null ? null : sma50GapPercent < 0,
    belowBbLower: bbLowerGapPercent === null ? null : bbLowerGapPercent < 0,
  };
}

export function riskFlag(features: ReboundRiskFeatures, rule: RiskRule): boolean | null {
  switch (rule) {
    case "THIN_VOLUME": return features.thinVolume;
    case "BELOW_SMA50": return features.belowSma50;
    case "BELOW_BB_LOWER": return features.belowBbLower;
    case "ANY": {
      const flags = [features.thinVolume, features.belowSma50, features.belowBbLower];
      // Never silently interpret unavailable data as a safe investment.
      return flags.some((flag) => flag === null) ? null : flags.some(Boolean);
    }
  }
}

export function buildReboundRiskCases(studies: Array<{
  code: string; candles: ReboundCandle[]; splitEvents?: number[];
  opportunities: ReboundOpportunity[];
}>): ReboundRiskCase[] {
  return studies.flatMap((study) => study.opportunities.map((item) => ({
    code: study.code, hintTime: item.hintTime, signalIndex: item.hintIndex,
    trade: item.hintTrade,
    features: inspectReboundHint(study.candles, item.hintIndex, study.splitEvents ?? []),
  })));
}

export function inReboundRiskPhase(trade: ReboundTrade, phase: RiskPhase): boolean {
  return phase === "ALL" ||
    (phase === "TRAIN" && trade.exitTime < REBOUND_RISK_CUTOFF) ||
    (phase === "TEST" && trade.entryTime >= REBOUND_RISK_CUTOFF);
}

function summarize(trades: ReboundTrade[]): RiskAggregate {
  const count = trades.length;
  const wins = trades.filter((trade) => trade.returnPercent > 0).length;
  const majorLosses = trades.filter((trade) => trade.returnPercent <= REBOUND_BAD_LOSS_PERCENT).length;
  return {
    count, wins, majorLosses,
    majorLossRatePercent: count ? round(majorLosses * 100 / count) : null,
    winRatePercent: count ? round(wins * 100 / count) : null,
    averageReturnPercent: count ? round(average(trades.map((t) => t.returnPercent))) : null,
    worstReturnPercent: count ? Math.min(...trades.map((t) => t.returnPercent)) : null,
    totalPnlYen: round(trades.reduce((sum, t) => sum + t.pnlYen, 0)),
    intratradeMinus5Count: trades.filter((t) => t.worstIntratradePercent <= -5).length,
  };
}

export function assessReboundRiskRule(
  cases: ReboundRiskCase[], rule: RiskRule, phase: RiskPhase,
): RiskRuleResult {
  const finished = cases.filter((item) => item.trade && inReboundRiskPhase(item.trade, phase));
  const unknown = finished.filter((item) => riskFlag(item.features, rule) === null);
  const eligible = finished.filter((item) => riskFlag(item.features, rule) !== null);
  const rejected = eligible.filter((item) => riskFlag(item.features, rule) === true).map((item) => item.trade!);
  const retained = eligible.filter((item) => riskFlag(item.features, rule) === false).map((item) => item.trade!);
  return {
    rule, phase, pending: cases.filter((item) => !item.trade).length,
    totalCompleted: finished.length, featureMissing: unknown.length,
    eligible: summarize(eligible.map((item) => item.trade!)),
    rejected: summarize(rejected), retained: summarize(retained),
    removedMajorLosses: rejected.filter((trade) => trade.returnPercent <= REBOUND_BAD_LOSS_PERCENT).length,
    removedWinners: rejected.filter((trade) => trade.returnPercent > 0).length,
  };
}
