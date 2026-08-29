import { calculateEmaSeries, calculateMacd, calculateRsi } from "../technicalIndicatorMath.ts";
import { isValidTechnicalCandle, percentageDistance } from "./candleMetrics.ts";
import { calculateAtr, calculateObservationVolumeRatio, calculateSma } from "./indicators.ts";
import { calculateDmiSnapshot } from "./dmi.ts";
import type { ConfirmationEvidence, ConfirmationEvidenceDirection } from "./evidenceTypes.ts";
import type { TechnicalCandle, TechnicalTimeframe } from "./types.ts";

export const CONFIRMATION_THRESHOLDS = {
  slopeLookback: 5, rsiOversold: 30, rsiOverbought: 70, adxStrong: 25,
  volumeExpansion: 1.5, volumeContraction: 0.7, highAtrPercent: 4, lowAtrPercent: 1,
  volatilityExpansion: 1.25, volatilityContraction: 0.8, excessiveMaDistanceAtr: 2.5,
} as const;

type Context = { candles: readonly TechnicalCandle[]; closes: number[]; timeframe: TechnicalTimeframe;
  asOfIndex: number; timestamp: number; atr: number };

function score(value: number) { return Math.round(Math.max(0, Math.min(100, value))); }
function evidence(context: Context, input: Omit<ConfirmationEvidence, "id" | "timeframe" | "asOfIndex" | "timestamp" | "strength" | "confidence"> &
  { strength: number; confidence: number }): ConfirmationEvidence {
  return { ...input, id: `${context.timeframe}:${context.asOfIndex}:${input.source}:${input.name}`,
    timeframe: context.timeframe, asOfIndex: context.asOfIndex, timestamp: context.timestamp,
    strength: score(input.strength), confidence: score(input.confidence) };
}

function smaAt(closes: readonly number[], period: number, endIndex: number) {
  return calculateSma(closes.slice(0, endIndex + 1), period);
}

export function classifyRsiState(current: number, previous: number, older: number) {
  if (![current, previous, older].every(Number.isFinite)) return null;
  const zone = current <= CONFIRMATION_THRESHOLDS.rsiOversold ? "OVERSOLD"
    : current >= CONFIRMATION_THRESHOLDS.rsiOverbought ? "OVERBOUGHT" : "NEUTRAL";
  const movement = current > previous && previous >= older ? "RISING" : current < previous && previous <= older ? "FALLING" : "NEUTRAL";
  const transition = previous <= CONFIRMATION_THRESHOLDS.rsiOversold && current > CONFIRMATION_THRESHOLDS.rsiOversold
    ? "EXITING_OVERSOLD" : previous >= CONFIRMATION_THRESHOLDS.rsiOverbought && current < CONFIRMATION_THRESHOLDS.rsiOverbought
      ? "EXITING_OVERBOUGHT" : null;
  return { zone, movement, transition };
}

export function classifyMovingAverageCross(previousFast: number, previousSlow: number,
  currentFast: number, currentSlow: number): "GOLDEN_CROSS" | "DEAD_CROSS" | null {
  if (![previousFast, previousSlow, currentFast, currentSlow].every(Number.isFinite)) return null;
  if (previousFast <= previousSlow && currentFast > currentSlow) return "GOLDEN_CROSS";
  if (previousFast >= previousSlow && currentFast < currentSlow) return "DEAD_CROSS";
  return null;
}

export function classifyMacdCross(previousMacd: number, previousSignal: number,
  currentMacd: number, currentSignal: number): "GOLDEN_CROSS" | "DEAD_CROSS" | null {
  if (![previousMacd, previousSignal, currentMacd, currentSignal].every(Number.isFinite)) return null;
  if (previousMacd <= previousSignal && currentMacd > currentSignal) return "GOLDEN_CROSS";
  if (previousMacd >= previousSignal && currentMacd < currentSignal) return "DEAD_CROSS";
  return null;
}

export function classifyMacdHistogram(current: number, previous: number, older: number) {
  if (![current, previous, older].every(Number.isFinite)) return null;
  return {
    polarity: current > 0 ? "POSITIVE" : current < 0 ? "NEGATIVE" : "NEUTRAL",
    change: Math.abs(current) > Math.abs(previous) && Math.abs(previous) >= Math.abs(older)
      ? "EXPANDING" : "CONTRACTING",
  } as const;
}

function movingAverageEvidence(context: Context): ConfirmationEvidence[] {
  const results: ConfirmationEvidence[] = []; const current = context.closes.at(-1)!;
  const periods = [20, 60, 120] as const;
  const values = periods.map((period) => smaAt(context.closes, period, context.closes.length - 1));
  const previousValues = periods.map((period) => smaAt(context.closes, period, context.closes.length - 2));
  if (values.every((value): value is number => value !== null)) {
    const bullish = current > values[0] && values[0] > values[1] && values[1] > values[2];
    const bearish = current < values[0] && values[0] < values[1] && values[1] < values[2];
    if (bullish || bearish) results.push(evidence(context, { category: "MOVING_AVERAGE", name: "MA_ALIGNMENT",
      direction: bullish ? "BULLISH" : "BEARISH", status: bullish ? "BULLISH_ALIGNMENT" : "BEARISH_ALIGNMENT",
      strength: 75, confidence: 80, source: "SMA_20_60_120", family: "MA_TREND", correlationGroup: "MA_ALIGNMENT",
      values: { price: current, ma20: values[0], ma60: values[1], ma120: values[2] } }));
    const distancePercent = percentageDistance(current, values[0])!; const distanceAtr = (current - values[0]) / context.atr;
    results.push(evidence(context, { category: "MOVING_AVERAGE", name: "PRICE_MA20_DISTANCE",
      direction: current > values[0] ? "BULLISH" : current < values[0] ? "BEARISH" : "NEUTRAL", status: Math.abs(distanceAtr) >= CONFIRMATION_THRESHOLDS.excessiveMaDistanceAtr ? "EXCESSIVE_DISTANCE" : "NORMAL_DISTANCE",
      strength: Math.min(100, Math.abs(distanceAtr) * 30), confidence: 75, source: "SMA20", family: "MA_TREND", correlationGroup: "MA_DISTANCE",
      values: { price: current, ma: values[0], priceDistancePercent: distancePercent, priceDistanceAtrRatio: distanceAtr } }));
    for (const [index, period] of periods.entries()) results.push(evidence(context, {
      category: "MOVING_AVERAGE", name: `PRICE_MA${period}_RELATION`,
      direction: current > values[index] ? "BULLISH" : current < values[index] ? "BEARISH" : "NEUTRAL",
      status: current > values[index] ? "ABOVE_MA" : current < values[index] ? "BELOW_MA" : "AT_MA",
      strength: Math.min(100, Math.abs(current - values[index]) / context.atr * 30), confidence: 80,
      source: `SMA${period}`, family: "MA_TREND", correlationGroup: "MA_PRICE_RELATION",
      values: { period, price: current, ma: values[index] },
    }));
    const latest = context.candles.at(-1)!;
    if (latest.low <= values[0] && latest.high >= values[0]) results.push(evidence(context, {
      category: "MOVING_AVERAGE", name: "MA20_INTERACTION",
      direction: current > values[0] ? "BULLISH" : current < values[0] ? "BEARISH" : "NEUTRAL",
      status: current > values[0] && latest.close > latest.open ? "REJECTION_ABOVE_CANDIDATE"
        : current < values[0] && latest.close < latest.open ? "REJECTION_BELOW_CANDIDATE" : "TOUCH_CANDIDATE",
      strength: 60, confidence: 65, source: "SMA20", family: "MA_INTERACTION", correlationGroup: "MA20_TOUCH",
      values: { ma: values[0], low: latest.low, high: latest.high, close: latest.close },
    }));
  }
  if (values[0] !== null && values[1] !== null && previousValues[0] !== null && previousValues[1] !== null) {
    const cross = classifyMovingAverageCross(previousValues[0], previousValues[1], values[0], values[1]);
    if (cross) results.push(evidence(context, { category: "MOVING_AVERAGE", name: cross,
      direction: cross === "GOLDEN_CROSS" ? "BULLISH" : "BEARISH", status: "CROSSED", strength: 75, confidence: 85,
      source: "SMA20_SMA60", family: "MA_TREND", correlationGroup: "MA_CROSS",
      values: { fast: values[0], slow: values[1], previousFast: previousValues[0], previousSlow: previousValues[1], crossIndex: context.asOfIndex, crossTimestamp: context.timestamp } }));
  }
  const ema20 = calculateEmaSeries(context.closes, 20); const ema75 = calculateEmaSeries(context.closes, 75); const ema200 = calculateEmaSeries(context.closes, 200);
  const last = context.closes.length - 1; const e20 = ema20[last]; const e75 = ema75[last]; const e200 = ema200[last];
  if (e20 !== null && e75 !== null && e200 !== null) {
    const bullish = current > e20 && e20 > e75 && e75 > e200; const bearish = current < e20 && e20 < e75 && e75 < e200;
    if (bullish || bearish) results.push(evidence(context, { category: "MOVING_AVERAGE", name: "EMA_ALIGNMENT",
      direction: bullish ? "BULLISH" : "BEARISH", status: bullish ? "BULLISH_ALIGNMENT" : "BEARISH_ALIGNMENT",
      strength: 80, confidence: 82, source: "EMA_20_75_200", family: "MA_TREND", correlationGroup: "MA_ALIGNMENT",
      values: { price: current, ema20: e20, ema75: e75, ema200: e200 } }));
    const emaDistancePercent = percentageDistance(current, e20)!;
    const emaDistanceAtr = (current - e20) / context.atr;
    results.push(evidence(context, { category: "MOVING_AVERAGE", name: "PRICE_EMA20_DISTANCE",
      direction: current > e20 ? "BULLISH" : current < e20 ? "BEARISH" : "NEUTRAL",
      status: Math.abs(emaDistanceAtr) >= CONFIRMATION_THRESHOLDS.excessiveMaDistanceAtr ? "EXCESSIVE_DISTANCE" : "NORMAL_DISTANCE",
      strength: Math.min(100, Math.abs(emaDistanceAtr) * 30), confidence: 75, source: "EMA20",
      family: "MA_TREND", correlationGroup: "MA_DISTANCE",
      values: { price: current, ema: e20, priceDistancePercent: emaDistancePercent, priceDistanceAtrRatio: emaDistanceAtr } }));
  }
  if (e20 !== null && last >= CONFIRMATION_THRESHOLDS.slopeLookback && ema20[last - CONFIRMATION_THRESHOLDS.slopeLookback] !== null) {
    const old = ema20[last - CONFIRMATION_THRESHOLDS.slopeLookback]!; const slopePercent = (e20 - old) / old * 100;
    results.push(evidence(context, { category: "MOVING_AVERAGE", name: "EMA20_SLOPE",
      direction: slopePercent > 0 ? "BULLISH" : slopePercent < 0 ? "BEARISH" : "NEUTRAL", status: slopePercent > 0 ? "RISING" : slopePercent < 0 ? "FALLING" : "FLAT",
      strength: Math.abs(slopePercent) * 20, confidence: 75, source: "EMA20", family: "MA_TREND", correlationGroup: "MA_SLOPE",
      values: { slopePercent, lookback: CONFIRMATION_THRESHOLDS.slopeLookback, currentEma: e20, previousEma: old } }));
  }
  if (values[0] !== null && context.closes.length > CONFIRMATION_THRESHOLDS.slopeLookback) {
    const old = smaAt(context.closes, 20, context.closes.length - 1 - CONFIRMATION_THRESHOLDS.slopeLookback);
    if (old !== null && old !== 0) {
      const slopePercent = (values[0] - old) / old * 100;
      results.push(evidence(context, { category: "MOVING_AVERAGE", name: "MA20_SLOPE",
        direction: slopePercent > 0 ? "BULLISH" : slopePercent < 0 ? "BEARISH" : "NEUTRAL",
        status: slopePercent > 0 ? "RISING" : slopePercent < 0 ? "FALLING" : "FLAT",
        strength: Math.abs(slopePercent) * 20, confidence: 75, source: "SMA20", family: "MA_TREND",
        correlationGroup: "MA_SLOPE", values: { slopePercent, lookback: CONFIRMATION_THRESHOLDS.slopeLookback,
          currentMa: values[0], previousMa: old } }));
    }
  }
  return results;
}

function rsiEvidence(context: Context): ConfirmationEvidence[] {
  if (context.closes.length < 17) return [];
  const current = calculateRsi(context.closes, 14); const previous = calculateRsi(context.closes.slice(0, -1), 14);
  const older = calculateRsi(context.closes.slice(0, -2), 14); const state = classifyRsiState(current, previous, older);
  if (!state) return [];
  const results = [evidence(context, { category: "MOMENTUM", name: "RSI_ZONE", direction: "NEUTRAL", status: state.zone,
    strength: state.zone === "NEUTRAL" ? 40 : Math.min(100, 60 + Math.abs(current - 50)), confidence: 85,
    source: "RSI14", family: "MOMENTUM_RSI", correlationGroup: "RSI_STATE", values: { rsi: current, previousRsi: previous, olderRsi: older } })];
  const transitionDirection: ConfirmationEvidenceDirection = state.transition === "EXITING_OVERSOLD" ? "BULLISH"
    : state.transition === "EXITING_OVERBOUGHT" ? "BEARISH" : state.movement === "RISING" ? "BULLISH" : state.movement === "FALLING" ? "BEARISH" : "NEUTRAL";
  results.push(evidence(context, { category: "MOMENTUM", name: "RSI_MOVEMENT", direction: transitionDirection,
    status: state.transition ?? state.movement, strength: Math.min(100, 50 + Math.abs(current - previous) * 5), confidence: 78,
    source: "RSI14", family: "MOMENTUM_RSI", correlationGroup: "RSI_STATE", values: { rsi: current, previousRsi: previous, movement: state.movement, transition: state.transition } }));
  return results;
}

function macdEvidence(context: Context): ConfirmationEvidence[] {
  if (context.closes.length < 37) return [];
  const current = calculateMacd(context.closes); const previous = calculateMacd(context.closes.slice(0, -1));
  const older = calculateMacd(context.closes.slice(0, -2));
  if (current.macd === null || current.signal === null || current.histogram === null || previous.macd === null || previous.signal === null || previous.histogram === null || older.histogram === null) return [];
  const cross = classifyMacdCross(previous.macd, previous.signal, current.macd, current.signal);
  const direction: ConfirmationEvidenceDirection = current.macd > current.signal ? "BULLISH" : current.macd < current.signal ? "BEARISH" : "NEUTRAL";
  const results = [evidence(context, { category: "MOMENTUM", name: "MACD_RELATION", direction,
    status: cross === "GOLDEN_CROSS" ? "BULLISH_CROSSOVER" : cross === "DEAD_CROSS" ? "BEARISH_CROSSOVER" : current.macd > current.signal ? "ABOVE_SIGNAL" : current.macd < current.signal ? "BELOW_SIGNAL" : "EQUAL_SIGNAL",
    strength: Math.min(100, 55 + Math.abs(current.histogram) / context.atr * 30), confidence: 82,
    source: "MACD_12_26_9", family: "MOMENTUM_MACD", correlationGroup: "MACD_STATE",
    values: { macd: current.macd, signal: current.signal, histogram: current.histogram, previousMacd: previous.macd, previousSignal: previous.signal } })];
  const histogramState = classifyMacdHistogram(current.histogram, previous.histogram, older.histogram)!;
  results.push(evidence(context, { category: "MOMENTUM", name: "MACD_HISTOGRAM", direction: current.histogram > 0 ? "BULLISH" : current.histogram < 0 ? "BEARISH" : "NEUTRAL",
    status: histogramState.change, strength: Math.min(100, 50 + Math.abs(current.histogram - previous.histogram) / context.atr * 50), confidence: 75,
    source: "MACD_12_26_9", family: "MOMENTUM_MACD", correlationGroup: "MACD_STATE",
    values: { histogram: current.histogram, previousHistogram: previous.histogram, olderHistogram: older.histogram, positive: current.histogram > 0 } }));
  return results;
}

function dmiEvidence(context: Context): ConfirmationEvidence[] {
  const current = calculateDmiSnapshot(context.candles); const previous = calculateDmiSnapshot(context.candles.slice(0, -1));
  if (!current || !previous) return [];
  const direction: ConfirmationEvidenceDirection = current.plusDi > current.minusDi ? "BULLISH" : current.minusDi > current.plusDi ? "BEARISH" : "NEUTRAL";
  return [
    evidence(context, { category: "TREND", name: "ADX_TREND_STRENGTH", direction: "NEUTRAL",
      status: current.adx >= CONFIRMATION_THRESHOLDS.adxStrong ? "STRONG_TREND" : "WEAK_TREND",
      strength: current.adx, confidence: 82, source: "ADX14", family: "TREND_STRENGTH_ADX", correlationGroup: "ADX_STRENGTH",
      values: { adx: current.adx, previousAdx: previous.adx, rising: current.adx > previous.adx } }),
    evidence(context, { category: "TREND", name: "ADX_MOVEMENT", direction: "NEUTRAL",
      status: current.adx > previous.adx ? "ADX_RISING" : current.adx < previous.adx ? "ADX_FALLING" : "ADX_FLAT",
      strength: Math.min(100, Math.abs(current.adx - previous.adx) * 5), confidence: 75,
      source: "ADX14", family: "TREND_STRENGTH_ADX", correlationGroup: "ADX_STRENGTH",
      values: { adx: current.adx, previousAdx: previous.adx } }),
    evidence(context, { category: "TREND", name: "DMI_DIRECTION", direction,
      status: direction === "BULLISH" ? "PLUS_DI_ABOVE" : direction === "BEARISH" ? "MINUS_DI_ABOVE" : "DI_EQUAL",
      strength: Math.min(100, 50 + Math.abs(current.plusDi - current.minusDi)), confidence: 80,
      source: "DMI14", family: "TREND_DIRECTION_DMI", correlationGroup: "DMI_DIRECTION",
      values: { plusDi: current.plusDi, minusDi: current.minusDi, adx: current.adx } }),
  ];
}

function volumeEvidence(context: Context): ConfirmationEvidence[] {
  const ratio = calculateObservationVolumeRatio(context.candles, 20); if (ratio === null) return [];
  const previous = context.candles.slice(-21, -1); const average = previous.reduce((sum, item) => sum + item.volume, 0) / previous.length;
  const status = ratio >= CONFIRMATION_THRESHOLDS.volumeExpansion ? "VOLUME_EXPANSION"
    : ratio <= CONFIRMATION_THRESHOLDS.volumeContraction ? "VOLUME_CONTRACTION" : ratio >= 1 ? "ABOVE_AVERAGE_VOLUME" : "BELOW_AVERAGE_VOLUME";
  return [evidence(context, { category: "VOLUME", name: "VOLUME_REGIME", direction: "NEUTRAL", status,
    strength: Math.min(100, Math.abs(ratio - 1) * 70 + 40), confidence: 85, source: "VOLUME_RATIO_20",
    family: "VOLUME", correlationGroup: "VOLUME_REGIME", values: { volumeRatio: ratio, volumeAverage: average, currentVolume: context.candles.at(-1)!.volume } })];
}

function volatilityEvidence(context: Context): ConfirmationEvidence[] {
  const atrPercent = context.atr / context.closes.at(-1)! * 100;
  const historical: number[] = [];
  for (let end = Math.max(15, context.candles.length - 20); end < context.candles.length; end += 1) {
    const value = calculateAtr(context.candles.slice(0, end), 14); if (value !== null) historical.push(value);
  }
  const average = historical.length ? historical.reduce((sum, value) => sum + value, 0) / historical.length : null;
  const ratio = average && average > 0 ? context.atr / average : null;
  const regime = atrPercent >= CONFIRMATION_THRESHOLDS.highAtrPercent ? "HIGH_VOLATILITY"
    : atrPercent <= CONFIRMATION_THRESHOLDS.lowAtrPercent ? "LOW_VOLATILITY" : "NORMAL_VOLATILITY";
  const change = ratio === null ? "UNAVAILABLE" : ratio >= CONFIRMATION_THRESHOLDS.volatilityExpansion ? "VOLATILITY_EXPANSION"
    : ratio <= CONFIRMATION_THRESHOLDS.volatilityContraction ? "VOLATILITY_CONTRACTION" : "STABLE_VOLATILITY";
  const results = [evidence(context, { category: "VOLATILITY", name: "ATR_REGIME", direction: "NEUTRAL", status: regime,
    strength: Math.min(100, atrPercent * 15), confidence: 82, source: "ATR14", family: "VOLATILITY",
    correlationGroup: "ATR_REGIME", values: { atr: context.atr, atrPercent, historicalAtrAverage: average, atrExpansionRatio: ratio, change } })];
  if (ratio !== null) results.push(evidence(context, { category: "VOLATILITY", name: "ATR_CHANGE",
    direction: "NEUTRAL", status: change, strength: Math.min(100, Math.abs(ratio - 1) * 100), confidence: 75,
    source: "ATR14", family: "VOLATILITY", correlationGroup: "ATR_REGIME",
    values: { atr: context.atr, historicalAtrAverage: average, atrExpansionRatio: ratio } }));
  return results;
}

export function createIndicatorEvidence(candles: readonly TechnicalCandle[], timeframe: TechnicalTimeframe,
  options: { asOfIndex?: number } = {}): ConfirmationEvidence[] {
  const asOfIndex = options.asOfIndex ?? candles.length - 1;
  if (!Number.isInteger(asOfIndex) || asOfIndex < 0 || asOfIndex >= candles.length) return [];
  const visible = candles.slice(0, asOfIndex + 1);
  if (visible.some((candle) => !isValidTechnicalCandle(candle))) return [];
  const atr = calculateAtr(visible, 14); if (atr === null || atr <= 0) return [];
  const context: Context = { candles: visible, closes: visible.map((item) => item.close), timeframe,
    asOfIndex, timestamp: visible.at(-1)!.time, atr };
  return [...movingAverageEvidence(context), ...rsiEvidence(context), ...macdEvidence(context),
    ...dmiEvidence(context), ...volumeEvidence(context), ...volatilityEvidence(context)];
}
