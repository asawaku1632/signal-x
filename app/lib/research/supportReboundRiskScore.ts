import type { ReboundCandle, ReboundOpportunity, ReboundTrade } from "../supportReboundResearch.ts";
import { inReboundRiskPhase } from "./supportReboundRiskStudy.ts";
import type { RiskPhase } from "./supportReboundRiskStudy.ts";

/**
 * v1 EXPLORATORY risk score, not a calibrated probability and not an AI signal.
 * Five fixed weights total 100; evaluated only using candles at/before hint close.
 * Missing input, insufficient 60-day history, or splits in lookback => UNKNOWN.
 * No selection/optimization of weights against historical outcomes.
 */
export const REBOUND_SCORE_VERSION = "REBOUND_LOSS_RISK_V1";
export type RiskBand = "LOW" | "MID" | "HIGH";
export type ScoreFeature = {
  rsi14: number;
  atr14Percent: number;
  sma50Slope10Percent: number;
  volumeRatio20: number;
  bbLowerGapPercent: number;
};
export type ScoredHint = {
  code: string; hintTime: number; trade: ReboundTrade | null;
  score: number | null; band: RiskBand | null; features: ScoreFeature | null;
};
export type ScoreMetrics = {
  count: number; wins: number; bigLosses: number; bigLossPercent: number | null;
  winPercent: number | null; avgPercent: number | null; worstPercent: number | null;
  avgDrawdownPercent: number | null;
};
export type ScoreBandSummary = {
  band: RiskBand; metrics: ScoreMetrics;
};
export type ScoreComparison = {
  phase: RiskPhase; completed: number; unknown: number; pending: number;
  known: ScoreMetrics; retained: ScoreMetrics; excluded: ScoreMetrics;
  excludedWinners: number; excludedBigLosses: number;
  bands: ScoreBandSummary[];
};
const BANDS: RiskBand[] = ["LOW", "MID", "HIGH"];
const round = (v: number) => Number(v.toFixed(2));
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

function historical(candles: ReboundCandle[], index: number, splits: number[]): ReboundCandle[] | null {
  if (!Number.isSafeInteger(index) || index < 59 || index >= candles.length) return null;
  const rows = candles.slice(index - 59, index + 1);
  if (rows.length !== 60 ||
    rows.some((row, pos) => !Number.isFinite(row.time) ||
      (pos > 0 && row.time <= rows[pos - 1].time) ||
      ![row.open, row.high, row.low, row.close].every((n) => Number.isFinite(n) && n > 0) ||
      row.high < Math.max(row.open, row.close, row.low) ||
      row.low > Math.min(row.open, row.close) ||
      !Number.isFinite(row.volume) || row.volume <= 0)) return null;
  if (splits.some((event) => Number.isFinite(event) && event >= rows[0].time && event <= rows[59].time)) return null;
  return rows;
}

/** All indicators at the close of the hint bar, no future bars read. */
export function scoreHintAtClose(candles: ReboundCandle[], index: number, splits: number[] = []):
  { score: number | null; band: RiskBand | null; features: ScoreFeature | null } {
  const unknown = { score: null, band: null, features: null };
  const rows = historical(candles, index, splits);
  if (!rows) return unknown;
  const closes = rows.map((bar) => bar.close);
  const current = rows[59];
  const currentSma = mean(closes.slice(10)); // last 50 bars
  const previousSma = mean(closes.slice(0, 50)); // previous 50, 10 sessions earlier
  if (!(currentSma > 0 && previousSma > 0)) return unknown;
  const smaSlope = 100 * (currentSma / previousSma - 1);
  const volumeRatio = current.volume / mean(rows.slice(39, 59).map((bar) => bar.volume));

  // RSI14 Wilder-smoothed with a full 59-bar warm-up (not a one-bar RSI).
  let gains = 0, losses = 0;
  for (let i = 1; i <= 14; i++) {
    const delta = closes[i] - closes[i - 1];
    gains += Math.max(delta, 0);
    losses += Math.max(-delta, 0);
  }
  let avgGain = gains / 14, avgLoss = losses / 14;
  for (let i = 15; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * 13 + Math.max(diff, 0)) / 14;
    avgLoss = (avgLoss * 13 + Math.max(-diff, 0)) / 14;
  }
  const rsi = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);

  // ATR14 Wilder-smoothed, using only current/past daily HLC.
  const trueRanges: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const bar = rows[i];
    const prevClose = rows[i - 1].close;
    trueRanges.push(Math.max(bar.high - bar.low, Math.abs(bar.high - prevClose), Math.abs(bar.low - prevClose)));
  }
  let atr = mean(trueRanges.slice(0, 14));
  for (let i = 14; i < trueRanges.length; i++) atr = (atr * 13 + trueRanges[i]) / 14;
  const atrPercent = 100 * atr / current.close;

  const bb = closes.slice(-20);
  const bbMean = mean(bb);
  const variance = mean(bb.map((close) => (close - bbMean) ** 2));
  const bbLower = bbMean - 2 * Math.sqrt(variance);
  if (!(bbLower > 0 && Number.isFinite(rsi) && Number.isFinite(atrPercent) &&
    Number.isFinite(volumeRatio) && Number.isFinite(smaSlope))) return unknown;
  const bbLowerGap = 100 * (current.close / bbLower - 1);

  // Independent, pre-declared exploratory hypotheses. Values are not tuned to outcomes.
  const points =
    (volumeRatio < 0.7 ? 15 : 0) +
    (smaSlope <= -3 ? 25 : smaSlope < 0 ? 15 : 0) +
    (atrPercent >= 5 ? 25 : atrPercent >= 3 ? 15 : 0) +
    (rsi < 30 ? 20 : rsi < 40 ? 10 : rsi > 70 ? 10 : 0) +
    (bbLowerGap < 0 ? 15 : 0);
  const band: RiskBand = points >= 60 ? "HIGH" : points >= 30 ? "MID" : "LOW";
  return {
    score: points, band,
    features: {
      rsi14: round(rsi), atr14Percent: round(atrPercent),
      sma50Slope10Percent: round(smaSlope), volumeRatio20: round(volumeRatio),
      bbLowerGapPercent: round(bbLowerGap),
    },
  };
}

export function buildScoredHints(studies: Array<{
  code: string; candles: ReboundCandle[]; splitEvents?: number[];
  opportunities: ReboundOpportunity[];
}>): ScoredHint[] {
  return studies.flatMap((study) => study.opportunities.map((o) => ({
    code: study.code, hintTime: o.hintTime, trade: o.hintTrade,
    ...scoreHintAtClose(study.candles, o.hintIndex, study.splitEvents ?? []),
  })));
}

function metrics(items: ScoredHint[]): ScoreMetrics {
  const trades = items.flatMap((x) => x.trade ? [x.trade] : []);
  const count = trades.length, wins = trades.filter((t) => t.pnlYen > 0).length;
  const losses = trades.filter((t) => t.returnPercent <= -5).length;
  return {
    count, wins, bigLosses: losses,
    bigLossPercent: count ? round(100 * losses / count) : null,
    winPercent: count ? round(100 * wins / count) : null,
    avgPercent: count ? round(mean(trades.map((t) => t.returnPercent))) : null,
    worstPercent: count ? Math.min(...trades.map((t) => t.returnPercent)) : null,
    avgDrawdownPercent: count ? round(mean(trades.map((t) => t.worstIntratradePercent))) : null,
  };
}

/** All comparisons operate on the SAME scorable completed trades. */
export function compareRiskScore(items: ScoredHint[], phase: RiskPhase): ScoreComparison {
  const complete = items.filter((x) => x.trade && inReboundRiskPhase(x.trade, phase));
  const scorable = complete.filter((x) => x.score !== null && x.band !== null);
  const retained = scorable.filter((x) => x.band !== "HIGH");
  const excluded = scorable.filter((x) => x.band === "HIGH");
  return {
    phase, completed: complete.length, unknown: complete.length - scorable.length,
    pending: phase === "ALL" ? items.filter((x) => !x.trade).length : 0,
    known: metrics(scorable), retained: metrics(retained), excluded: metrics(excluded),
    excludedWinners: excluded.filter((x) => x.trade!.pnlYen > 0).length,
    excludedBigLosses: excluded.filter((x) => x.trade!.returnPercent <= -5).length,
    bands: BANDS.map((band) => ({ band, metrics: metrics(scorable.filter((x) => x.band === band)) })),
  };
}
