/**
 * SHADOW ONLY — three-way, nested filtering of the EXACT SAME completed trades
 * created by the existing horizontal-retest simulator. No alternative fills,
 * no AI POWER reconstruction, no writes, no trade/LINE/production imports.
 *
 * All eligibility indicators are computed only as-of the original signal:
 * breakout day for volume and moving averages; retest day for RSI/MACD/candle.
 * The exit outcome is only read AFTER eligibility has been fixed.
 */
import { calculateMacd, calculateRsi } from "../technicalIndicatorMath.ts";
import {
  HORIZONTAL_RETEST_VERSION,
  studyHorizontalRetest,
  type HorizontalCandle,
  type HorizontalTrade,
} from "./horizontalRetest.ts";

export const HORIZONTAL_COMPARE_VERSION = "shadow_horizontal_compare_v1" as const;
export type CompareVariantId = "BASE" | "TREND_VOLUME" | "TECHNICAL";
export const HORIZONTAL_VARIANTS: readonly { id: CompareVariantId; name: string; criteria: string }[] = [
  { id: "BASE", name: "① 水平線単独", criteria: "従来の水平線ブレイク＋押し目反発（出来高1.2倍・日足20日平均＞50日平均を含む）" },
  { id: "TREND_VOLUME", name: "② トレンド・出来高強化", criteria: "①＋突破時出来高1.5倍以上＋20日平均が50日平均を1.2%以上上回り、20日平均が5営業日前より上昇" },
  { id: "TECHNICAL", name: "③ SIGNALX型の技術条件", criteria: "②＋押し目反発時のRSI(14)が45〜70＋MACDヒストグラムが正＋陽線の終値が値幅上位35%以内" },
] as const;

export type CompareInput = { code: string; candles: readonly HorizontalCandle[] };
export type CompareEntry = {
  code: string;
  breakoutTime: number;
  retestTime: number;
  entryTime: number;
  exitTime: number;
  trade: HorizontalTrade;
  eligible: Record<CompareVariantId, boolean>;
  breakoutVolumeRatio: number | null;
  maSpreadPercent: number | null;
  rsiAtRetest: number | null;
  macdHistogramAtRetest: number | null;
  failed: string[];
};
export type CompareStats = {
  id: CompareVariantId;
  name: string;
  eligible: number;
  rejectedFromBase: number;
  wins: number;
  losses: number;
  winRatePercent: number | null;
  profitYen100: number;
  averageProfitYen100: number | null;
  averageReturnPercent: number | null;
  worstProfitYen100: number | null;
  maxDrawdownYen100: number | null;
};
export type CompareResult = {
  version: typeof HORIZONTAL_COMPARE_VERSION;
  baseVersion: typeof HORIZONTAL_RETEST_VERSION;
  cohortCount: number;
  firstBarTime: number | null;
  lastBarTime: number | null;
  totalBreakouts: number;
  totalRetests: number;
  completedBaseTrades: number;
  comparison: CompareStats[];
  entries: CompareEntry[];
};
const avg = (numbers: readonly number[]) => numbers.reduce((s, n) => s + n, 0) / numbers.length;
const pct = (n: number) => Math.round(n * 100) / 100;

function asOfFeatures(c: readonly HorizontalCandle[], trade: HorizontalTrade) {
  const bi = trade.breakoutIndex;
  const ri = trade.retestIndex;
  const closes = c.slice(0, bi + 1).map(b => b.close);
  const ma20 = avg(closes.slice(-20));
  const ma50 = avg(closes.slice(-50));
  const priorMa20 = avg(c.slice(bi - 24, bi - 4).map(b => b.close));
  const vol = c.slice(bi - 20, bi).map(b => b.volume ?? 0);
  const todayVol = c[bi].volume ?? 0;
  const volumeRatio = vol.length === 20 && vol.every(v => v > 0 && Number.isFinite(v)) &&
    todayVol > 0 && Number.isFinite(todayVol) ? todayVol / avg(vol) : null;
  const maSpreadPercent = ma50 > 0 ? (ma20 / ma50 - 1) * 100 : null;
  const trendVolume = volumeRatio !== null && volumeRatio >= 1.5 &&
    maSpreadPercent !== null && maSpreadPercent >= 1.2 &&
    Number.isFinite(priorMa20) && ma20 > priorMa20;

  const retest = c[ri];
  const retestCloses = c.slice(0, ri + 1).map(b => b.close);
  const rsiAtRetest = retestCloses.length >= 15 ? calculateRsi(retestCloses, 14) : null;
  const macdHistogramAtRetest = calculateMacd(retestCloses).histogram;
  const range = retest.high - retest.low;
  const strongBullCandle = range > 0 && retest.close > retest.open &&
    (retest.close - retest.low) / range >= 0.65;
  const technical = trendVolume && rsiAtRetest !== null &&
    rsiAtRetest >= 45 && rsiAtRetest <= 70 &&
    macdHistogramAtRetest !== null && macdHistogramAtRetest > 0 && strongBullCandle;
  const failed: string[] = [];
  if (volumeRatio === null || volumeRatio < 1.5) failed.push("出来高1.5倍未満／不明");
  if (maSpreadPercent === null || maSpreadPercent < 1.2 || !(ma20 > priorMa20)) failed.push("上昇トレンド強化条件外");
  if (rsiAtRetest === null || rsiAtRetest < 45 || rsiAtRetest > 70) failed.push("RSI条件外");
  if (macdHistogramAtRetest === null || macdHistogramAtRetest <= 0) failed.push("MACD条件外");
  if (!strongBullCandle) failed.push("反発陽線の強度不足");
  return { trendVolume, technical, volumeRatio, maSpreadPercent, rsiAtRetest, macdHistogramAtRetest, failed };
}

function summarize(id: CompareVariantId, name: string, entries: readonly CompareEntry[]): CompareStats {
  const selected = entries.filter(e => e.eligible[id]);
  const ordered = [...selected].sort((a, b) => a.exitTime - b.exitTime ||
    a.entryTime - b.entryTime || a.code.localeCompare(b.code));
  const pnls = ordered.map(e => e.trade.profitYen100);
  const profitYen100 = pnls.reduce((s, n) => s + n, 0);
  const wins = pnls.filter(n => n > 0).length;
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  for (const value of pnls) {
    equity += value;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
  }
  return {
    id, name, eligible: selected.length, rejectedFromBase: entries.length - selected.length,
    wins, losses: pnls.length - wins,
    winRatePercent: pnls.length ? pct(100 * wins / pnls.length) : null,
    profitYen100, averageProfitYen100: pnls.length ? Math.round(profitYen100 / pnls.length) : null,
    averageReturnPercent: pnls.length ? pct(avg(ordered.map(e => e.trade.returnPercent))) : null,
    worstProfitYen100: pnls.length ? Math.min(...pnls) : null,
    maxDrawdownYen100: pnls.length ? drawdown : null,
  };
}

export function compareHorizontalRetest(cohorts: readonly CompareInput[]): CompareResult {
  const entries: CompareEntry[] = [];
  let totalBreakouts = 0;
  let totalRetests = 0;
  let firstBarTime: number | null = null;
  let lastBarTime: number | null = null;
  for (const { code, candles } of cohorts) {
    const study = studyHorizontalRetest(candles);
    totalBreakouts += study.breakoutCount;
    totalRetests += study.retestCount;
    if (candles.length) {
      firstBarTime = firstBarTime === null ? candles[0].time : Math.min(firstBarTime, candles[0].time);
      lastBarTime = lastBarTime === null ? candles[candles.length - 1].time : Math.max(lastBarTime, candles[candles.length - 1].time);
    }
    for (const trade of study.trades) {
      const features = asOfFeatures(candles, trade);
      entries.push({
        code, breakoutTime: candles[trade.breakoutIndex].time,
        retestTime: candles[trade.retestIndex].time,
        entryTime: candles[trade.entryIndex].time,
        exitTime: candles[trade.exitIndex].time, trade,
        eligible: { BASE: true, TREND_VOLUME: features.trendVolume, TECHNICAL: features.technical },
        breakoutVolumeRatio: features.volumeRatio,
        maSpreadPercent: features.maSpreadPercent,
        rsiAtRetest: features.rsiAtRetest,
        macdHistogramAtRetest: features.macdHistogramAtRetest,
        failed: features.failed,
      });
    }
  }
  return {
    version: HORIZONTAL_COMPARE_VERSION, baseVersion: HORIZONTAL_RETEST_VERSION,
    cohortCount: cohorts.length, firstBarTime, lastBarTime,
    totalBreakouts, totalRetests, completedBaseTrades: entries.length,
    comparison: HORIZONTAL_VARIANTS.map(v => summarize(v.id, v.name, entries)),
    entries: entries.sort((a, b) => b.entryTime - a.entryTime || a.code.localeCompare(b.code)),
  };
}
