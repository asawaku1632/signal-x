import type { TechnicalCandle } from "./types.ts";

export function isValidTechnicalCandle(candle: TechnicalCandle): boolean {
  return Number.isFinite(candle.time) && candle.time >= 0 &&
    Number.isFinite(candle.open) && candle.open > 0 &&
    Number.isFinite(candle.high) && candle.high > 0 &&
    Number.isFinite(candle.low) && candle.low > 0 &&
    Number.isFinite(candle.close) && candle.close > 0 &&
    Number.isFinite(candle.volume) && candle.volume >= 0 &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close);
}

export function candleBody(candle: TechnicalCandle): number {
  return Math.abs(candle.close - candle.open);
}

export function candleRange(candle: TechnicalCandle): number {
  return Math.max(0, candle.high - candle.low);
}

export function upperWick(candle: TechnicalCandle): number {
  return Math.max(0, candle.high - Math.max(candle.open, candle.close));
}

export function lowerWick(candle: TechnicalCandle): number {
  return Math.max(0, Math.min(candle.open, candle.close) - candle.low);
}

export function bodyRangeRatio(candle: TechnicalCandle): number | null {
  const range = candleRange(candle);
  return range > 0 ? candleBody(candle) / range : null;
}

export function wickBodyRatio(wick: number, body: number): number | null {
  if (!Number.isFinite(wick) || !Number.isFinite(body) || wick < 0 || body <= 0) return null;
  return wick / body;
}

export function isBullishCandle(candle: TechnicalCandle): boolean {
  return candle.close > candle.open;
}

export function isBearishCandle(candle: TechnicalCandle): boolean {
  return candle.close < candle.open;
}

export function rollingHigh(candles: readonly TechnicalCandle[], window: number): number | null {
  if (!Number.isInteger(window) || window < 1 || candles.length < window) return null;
  const target = candles.slice(-window);
  if (target.some((candle) => !isValidTechnicalCandle(candle))) return null;
  return Math.max(...target.map((candle) => candle.high));
}

export function rollingLow(candles: readonly TechnicalCandle[], window: number): number | null {
  if (!Number.isInteger(window) || window < 1 || candles.length < window) return null;
  const target = candles.slice(-window);
  if (target.some((candle) => !isValidTechnicalCandle(candle))) return null;
  return Math.min(...target.map((candle) => candle.low));
}

export function trueRange(current: TechnicalCandle, previousClose?: number): number | null {
  if (!isValidTechnicalCandle(current)) return null;
  if (previousClose === undefined) return candleRange(current);
  if (!Number.isFinite(previousClose) || previousClose <= 0) return null;
  return Math.max(
    candleRange(current),
    Math.abs(current.high - previousClose),
    Math.abs(current.low - previousClose),
  );
}

export function averageTrueRange(
  candles: readonly TechnicalCandle[],
  period = 14,
): number | null {
  if (!Number.isInteger(period) || period < 1 || candles.length < period + 1) return null;
  const target = candles.slice(-(period + 1));
  if (target.some((candle) => !isValidTechnicalCandle(candle))) return null;
  const ranges = target.slice(1).map((candle, index) => trueRange(candle, target[index].close));
  if (ranges.some((value) => value === null)) return null;
  return (ranges as number[]).reduce((sum, value) => sum + value, 0) / period;
}

export function percentageDistance(value: number, reference: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(reference) || reference <= 0) return null;
  return ((value - reference) / reference) * 100;
}

export function maDistance(price: number, movingAverage: number | null): number | null {
  return movingAverage === null ? null : percentageDistance(price, movingAverage);
}
