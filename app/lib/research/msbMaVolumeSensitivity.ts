/**
 * SHADOW ONLY / pure retrospective sensitivity diagnostics for MA5/25 + MSB/OB.
 * No IO, database, production trade model or notification dependencies.
 * Eligibility uses only as-of daily OHLCV; outcomes are consulted afterwards.
 */
import type { SwingResearchCandle, SwingResearchReport, SwingResearchTrade, ResearchVariant } from "./msbMaSwing.ts";
import { SWING_RESEARCH_VARIANTS } from "./msbMaSwing.ts";

export const VOLUME_SENSITIVITY_VERSION = "shadow_msb_volume_sensitivity_v1" as const;
export type VolumeStage = "BREAKOUT" | "RETEST" | "BOTH";
export type VolumeThreshold = 0 | 1 | 1.2 | 1.5;
export const VOLUME_STAGES: readonly { id: VolumeStage; label: string }[] = [
  { id: "BREAKOUT", label: "構造突破日の出来高" },
  { id: "RETEST", label: "反発日の出来高" },
  { id: "BOTH", label: "両日とも出来高条件を満たす" },
];
export const VOLUME_THRESHOLDS: readonly VolumeThreshold[] = [0, 1, 1.2, 1.5];

export type VolumeSensitivityEntry = {
  trade: SwingResearchTrade;
  breakoutRatio: number | null;
  retestRatio: number | null;
};
export type SensitivityStat = {
  count: number; wins: number; losses: number; winRatePercent: number | null;
  averageProfitYen100: number | null; totalProfitYen100: number;
  worstProfitYen100: number | null; averageReturnPercent: number | null;
};
export type VolumeSensitivityRow = {
  threshold: VolumeThreshold;
  breakout: SensitivityStat;
  retest: SensitivityStat;
  both: SensitivityStat;
};
export type NonOverlapVariant = SensitivityStat & { id: ResearchVariant; label: string };
export type VolumeSensitivityResult = {
  version: typeof VOLUME_SENSITIVITY_VERSION;
  baseObservationCount: number; nonOverlapBaseCount: number;
  obObservationCount: number; obNonOverlapCount: number; obRemovedForOverlap: number;
  missingBreakoutVolume: number; missingRetestVolume: number;
  baselineNonOverlap: NonOverlapVariant[];
  rows: VolumeSensitivityRow[];
  details: VolumeSensitivityEntry[];
};

const round = (n: number) => Math.round(n * 100) / 100;
function summarize(trades: readonly SwingResearchTrade[]): SensitivityStat {
  const wins = trades.filter(t => t.profitYen100 > 0).length;
  const total = trades.reduce((sum, t) => sum + t.profitYen100, 0);
  return {
    count: trades.length, wins, losses: trades.length - wins,
    winRatePercent: trades.length ? round(100 * wins / trades.length) : null,
    averageProfitYen100: trades.length ? Math.round(total / trades.length) : null,
    totalProfitYen100: total,
    worstProfitYen100: trades.length ? Math.min(...trades.map(t => t.profitYen100)) : null,
    averageReturnPercent: trades.length ? round(trades.reduce((s, t) => s + t.returnPercent, 0) / trades.length) : null,
  };
}

/**
 * Greedy, earliest-entry-per-symbol selection. A selected observation blocks
 * subsequent entries in that symbol through its exit CLOSE, inclusive.
 * The result is not a portfolio because different symbols may still overlap.
 */
export function selectNonOverlappingSwing<T extends SwingResearchTrade>(observations: readonly T[]): T[] {
  const ordered = [...observations].sort((a, b) =>
    a.code.localeCompare(b.code) || a.entryTime - b.entryTime || a.signalTime - b.signalTime);
  const lastExitByCode = new Map<string, number>();
  const result: T[] = [];
  for (const trade of ordered) {
    const last = lastExitByCode.get(trade.code) ?? -Infinity;
    if (trade.entryTime <= last) continue;
    result.push(trade);
    lastExitByCode.set(trade.code, trade.exitTime);
  }
  return result;
}

/** The breakout/retest volume ratio uses the preceding 20 COMPLETE trading bars.
 * Zero/missing volume is unknown, never a passing threshold.
 */
export function historicalVolumeRatio(bars: readonly SwingResearchCandle[], index: number): number | null {
  if (!Number.isInteger(index) || index < 20 || index >= bars.length) return null;
  const history = bars.slice(index - 20, index).map(b => b.volume);
  const current = bars[index].volume;
  if (history.length !== 20 || history.some(v => typeof v !== "number" || !Number.isFinite(v) || v <= 0)
    || typeof current !== "number" || !Number.isFinite(current) || current <= 0) return null;
  const average = (history as number[]).reduce((sum, v) => sum + v, 0) / 20;
  return average > 0 ? current / average : null;
}

function accepts(e: VolumeSensitivityEntry, stage: VolumeStage, threshold: VolumeThreshold): boolean {
  // 0 means "no volume requirement" and therefore accepts even unknown volume.
  if (threshold === 0) return true;
  const breakout = e.breakoutRatio !== null && e.breakoutRatio >= threshold;
  const retest = e.retestRatio !== null && e.retestRatio >= threshold;
  return stage === "BREAKOUT" ? breakout : stage === "RETEST" ? retest : breakout && retest;
}

export function studySwingVolumeSensitivity(
  cohorts: readonly { code: string; candles: readonly SwingResearchCandle[] }[],
  report: SwingResearchReport,
): VolumeSensitivityResult {
  const byCode = new Map(cohorts.map(({ code, candles }) => [code, candles]));
  const baseNonOverlap = selectNonOverlappingSwing(report.trades);
  const baselineNonOverlap: NonOverlapVariant[] = SWING_RESEARCH_VARIANTS.map(variant => ({
    id: variant.id, label: variant.label,
    ...summarize(baseNonOverlap.filter(t => t.eligible[variant.id])),
  }));

  // For a fair *threshold-only* comparison, first select the same non-overlapping
  // OB cohort once; then apply every ratio threshold to those very same entries.
  const rawOb = report.trades.filter(t => t.orderBlock !== null);
  const obNonOverlap = selectNonOverlappingSwing(rawOb);
  const details = obNonOverlap.map(trade => {
    const candles = byCode.get(trade.code);
    return {
      trade,
      breakoutRatio: candles && trade.orderBlock
        ? historicalVolumeRatio(candles, trade.orderBlock.breakIndex) : null,
      retestRatio: candles ? historicalVolumeRatio(candles, trade.signalIndex) : null,
    };
  });

  const rows = VOLUME_THRESHOLDS.map(threshold => {
    const byStage = (stage: VolumeStage) =>
      summarize(details.filter(entry => accepts(entry, stage, threshold)).map(entry => entry.trade));
    return {
      threshold,
      breakout: byStage("BREAKOUT"),
      retest: byStage("RETEST"),
      both: byStage("BOTH"),
    };
  });
  return {
    version: VOLUME_SENSITIVITY_VERSION,
    baseObservationCount: report.trades.length,
    nonOverlapBaseCount: baseNonOverlap.length,
    obObservationCount: rawOb.length,
    obNonOverlapCount: obNonOverlap.length,
    obRemovedForOverlap: rawOb.length - obNonOverlap.length,
    missingBreakoutVolume: details.filter(e => e.breakoutRatio === null).length,
    missingRetestVolume: details.filter(e => e.retestRatio === null).length,
    baselineNonOverlap, rows, details,
  };
}
