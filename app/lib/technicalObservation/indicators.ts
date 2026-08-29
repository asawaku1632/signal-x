import {
  calculateEma,
  calculateMacd,
  calculateRsi,
} from "../technicalIndicatorMath.ts";
import type {
  CandleDataset,
  IndicatorSnapshot,
  TechnicalCandle,
} from "./types.ts";

export function calculateSma(values: readonly number[], period: number) {
  if (!Number.isInteger(period) || period < 1 || values.length < period) return null;
  const target = values.slice(-period);
  return target.reduce((sum, value) => sum + value, 0) / period;
}

export function calculateAtr(candles: readonly TechnicalCandle[], period = 14) {
  if (!Number.isInteger(period) || period < 1 || candles.length < period + 1) return null;
  const target = candles.slice(-(period + 1));
  let total = 0;
  for (let index = 1; index < target.length; index += 1) {
    const current = target[index];
    const previousClose = target[index - 1].close;
    total += Math.max(
      current.high - current.low,
      Math.abs(current.high - previousClose),
      Math.abs(current.low - previousClose),
    );
  }
  return total / period;
}

export function calculateObservationVolumeRatio(
  candles: readonly TechnicalCandle[],
  comparisonPeriods = 20,
) {
  if (!Number.isInteger(comparisonPeriods) || comparisonPeriods < 1) return null;
  if (candles.length < comparisonPeriods + 1) return null;
  const target = candles.slice(-(comparisonPeriods + 1));
  const latest = target.at(-1)!.volume;
  const previous = target.slice(0, -1).map((candle) => candle.volume);
  if (latest < 0 || previous.some((volume) => volume <= 0)) return null;
  const average = previous.reduce((sum, volume) => sum + volume, 0) / previous.length;
  return average > 0 ? latest / average : null;
}

export function calculateNormalizedRegressionSlope(
  values: readonly number[],
  lookback: number,
  normalizationPrice: number,
) {
  if (!Number.isInteger(lookback) || lookback < 2 || values.length < lookback) return null;
  if (!Number.isFinite(normalizationPrice) || normalizationPrice <= 0) return null;
  const target = values.slice(-lookback);
  if (target.some((value) => !Number.isFinite(value))) return null;
  const meanX = (lookback - 1) / 2;
  const meanY = target.reduce((sum, value) => sum + value, 0) / lookback;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < lookback; index += 1) {
    numerator += (index - meanX) * (target[index] - meanY);
    denominator += (index - meanX) ** 2;
  }
  return denominator > 0 ? (numerator / denominator) / normalizationPrice : null;
}

export function calculateMaSpread(values: readonly (number | null)[], close: number) {
  if (!Number.isFinite(close) || close <= 0 || values.length < 2) return null;
  if (values.some((value) => value === null || !Number.isFinite(value))) return null;
  const finiteValues = values as number[];
  return (Math.max(...finiteValues) - Math.min(...finiteValues)) / close;
}

export function summarizeSpreadHistory(spreads: readonly (number | null)[]) {
  const current = spreads.at(-1) ?? null;
  const fiveAgo = spreads.length >= 6 ? spreads.at(-6) ?? null : null;
  const tenAgo = spreads.length >= 11 ? spreads.at(-11) ?? null : null;
  const valid = spreads.filter((value): value is number => value !== null && Number.isFinite(value));
  const minimum = valid.length ? Math.min(...valid) : null;
  const reference = tenAgo ?? fiveAgo;
  const contractionRate = current !== null && reference !== null && reference > 0
    ? (reference - current) / reference
    : null;
  const expansionRate = current !== null && minimum !== null && minimum > 0
    ? (current - minimum) / minimum
    : null;
  return { current, fiveAgo, tenAgo, minimum, contractionRate, expansionRate };
}

export function calculateRecentRange(
  candles: readonly TechnicalCandle[],
  window: number,
  asOfIndex = candles.length - 1,
) {
  if (!Number.isInteger(window) || window < 1) return null;
  if (!Number.isInteger(asOfIndex) || asOfIndex < window || asOfIndex >= candles.length) {
    return null;
  }
  const prior = candles.slice(asOfIndex - window, asOfIndex);
  if (prior.length !== window) return null;
  return {
    window,
    recentHigh: Math.max(...prior.map((candle) => candle.high)),
    recentLow: Math.min(...prior.map((candle) => candle.low)),
    firstBarAt: new Date(prior[0].time * 1_000).toISOString(),
    lastBarAt: new Date(prior.at(-1)!.time * 1_000).toISOString(),
  };
}

export function createIndicatorSnapshot(dataset: CandleDataset): IndicatorSnapshot | null {
  const latest = dataset.candles.at(-1);
  if (!latest || !dataset.lastBarAt) return null;
  const closes = dataset.candles.map((candle) => candle.close);
  const macd = closes.length >= 35
    ? calculateMacd(closes)
    : { macd: null, signal: null, histogram: null };
  return {
    timeframe: dataset.timeframe,
    tradeDate: dataset.sessionDate ?? new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(latest.time * 1_000)),
    barEndAt: dataset.lastBarAt,
    candleCount: dataset.candleCount,
    datasetStatus: dataset.status,
    complete: dataset.complete,
    price: {
      open: latest.open,
      high: latest.high,
      low: latest.low,
      close: latest.close,
      volume: latest.volume,
    },
    ma: {
      sma5: calculateSma(closes, 5),
      sma20: calculateSma(closes, 20),
      sma60: calculateSma(closes, 60),
      ema5: calculateEma(closes, 5),
      ema20: calculateEma(closes, 20),
      ema75: calculateEma(closes, 75),
      ema200: calculateEma(closes, 200),
    },
    momentum: {
      rsi14: closes.length >= 15 ? calculateRsi(closes, 14) : null,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHistogram: macd.histogram,
    },
    volatility: { atr14: calculateAtr(dataset.candles, 14) },
    volume: { ratio: calculateObservationVolumeRatio(dataset.candles, 20) },
  };
}
