import { backtestEmaCrossovers } from "./emaCrossoverBacktest.ts";
import type { EmaCandle } from "./emaCrossoverBacktest.ts";

export const EMA_VARIANT_IDS = ["BASE", "VOLUME", "BOLLINGER"] as const;
export type EmaVariantId = typeof EMA_VARIANT_IDS[number];

export const EMA_VARIANT_DETAILS: Record<EmaVariantId, { title: string; rule: string }> = {
  BASE: {
    title: "EMA9×21のみ",
    rule: "EMA9がEMA21を上抜けで買い、下抜けで売り",
  },
  VOLUME: {
    title: "EMA＋出来高",
    rule: "買い交差当日の出来高が直前20営業日の平均の1.5倍以上なら買い",
  },
  BOLLINGER: {
    title: "EMA＋BB",
    rule: "買い交差当日の終値がBB20（±2σ）の中央線以上・上側2σ未満なら買い",
  },
};

function prevVolumeAverage(candles: EmaCandle[], index: number): number | null {
  if (index < 20) return null;
  const previous = candles.slice(index - 20, index);
  if (previous.some((c) => !Number.isFinite(c.volume) || c.volume <= 0)) return null;
  return previous.reduce((total, c) => total + c.volume, 0) / 20;
}

export function volumeEntryAllowed(candles: EmaCandle[], index: number) {
  const average = prevVolumeAverage(candles, index);
  const current = candles[index]?.volume;
  return average !== null && average > 0 && Number.isFinite(current) && current > 0 && current >= 1.5 * average;
}

export function bollingerEntryAllowed(candles: EmaCandle[], index: number) {
  if (index < 19) return false;
  const closes = candles.slice(index - 19, index + 1).map((bar) => bar.close);
  if (closes.length !== 20 || closes.some((p) => !Number.isFinite(p) || p <= 0)) return false;
  const middle = closes.reduce((total, p) => total + p, 0) / 20;
  const variance = closes.reduce((total, p) => total + (p - middle) ** 2, 0) / 20;
  const upper = middle + 2 * Math.sqrt(variance);
  const latest = closes[19];
  return upper > middle && latest >= middle && latest < upper;
}

export function compareEmaVariants(candles: EmaCandle[]) {
  return {
    BASE: backtestEmaCrossovers(candles),
    VOLUME: backtestEmaCrossovers(candles, 100, (index) => volumeEntryAllowed(candles, index)),
    BOLLINGER: backtestEmaCrossovers(candles, 100, (index) => bollingerEntryAllowed(candles, index)),
  };
}
