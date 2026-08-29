import { isValidTechnicalCandle } from "./candleMetrics.ts";
import type { TechnicalCandle, TechnicalTimeframe } from "./types.ts";

export type TimeframeAvailability = "SUPPORTED" | "EXPERIMENTAL" | "UNAVAILABLE";
export type MultiTimeframeDataQuality = "COMPLETE" | "PARTIAL" | "STALE" | "INVALID" | "UNAVAILABLE";
export type TimeframeRole = "HIGHER" | "SETUP" | "TRIGGER";

export type TimeframeCapability = {
  timeframe: TechnicalTimeframe;
  availability: TimeframeAvailability;
  source: string | null;
  range: string | null;
  interval: string | null;
  maximumCandles: number | null;
  productionUse: string;
};

export const TIMEFRAME_CAPABILITIES: readonly TimeframeCapability[] = [
  { timeframe: "5M", availability: "EXPERIMENTAL", source: "YAHOO_CHART", range: "5d", interval: "5m",
    maximumCandles: 390, productionUse: "chart UI and stock analysis" },
  { timeframe: "15M", availability: "EXPERIMENTAL", source: "YAHOO_CHART", range: "1mo", interval: "15m",
    maximumCandles: 520, productionUse: "chart UI" },
  { timeframe: "1H", availability: "EXPERIMENTAL", source: "YAHOO_CHART", range: "3mo", interval: "60m",
    maximumCandles: 500, productionUse: "chart UI" },
  { timeframe: "1D", availability: "SUPPORTED", source: "YAHOO_CHART", range: "6mo/2y", interval: "1d",
    maximumCandles: 300, productionUse: "technicalObservation SHORT_90 and LONG_300" },
  { timeframe: "1W", availability: "EXPERIMENTAL", source: "YAHOO_CHART", range: "5y", interval: "1wk",
    maximumCandles: 260, productionUse: "chart UI" },
  { timeframe: "1M", availability: "EXPERIMENTAL", source: "YAHOO_CHART", range: "10y", interval: "1mo",
    maximumCandles: 120, productionUse: "chart UI" },
] as const;

export type CanonicalTimeline = {
  candles: TechnicalCandle[];
  rejectedCount: number;
  duplicateCount: number;
  missingBarCount: number;
  overnightGapCount: number;
};

const JST_OFFSET_SECONDS = 9 * 60 * 60;
const durationSeconds: Partial<Record<TechnicalTimeframe, number>> = {
  "5M": 5 * 60, "15M": 15 * 60, "1H": 60 * 60,
};

function jstParts(timestamp: number) {
  const date = new Date((timestamp + JST_OFFSET_SECONDS) * 1_000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), weekday: date.getUTCDay() };
}

function sameJstDate(left: number, right: number) {
  const a = jstParts(left); const b = jstParts(right);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function classifyTokyoSession(timestamp: number): "MORNING" | "LUNCH_BREAK" | "AFTERNOON" | "OUTSIDE" {
  if (!Number.isFinite(timestamp)) return "OUTSIDE";
  const { hour, minute, weekday } = jstParts(timestamp); const value = hour * 60 + minute;
  if (weekday === 0 || weekday === 6) return "OUTSIDE";
  if (value >= 9 * 60 && value < 11 * 60 + 30) return "MORNING";
  if (value >= 11 * 60 + 30 && value < 12 * 60 + 30) return "LUNCH_BREAK";
  if (value >= 12 * 60 + 30 && value < 15 * 60 + 30) return "AFTERNOON";
  return "OUTSIDE";
}

function sessionClose(timestamp: number) {
  const parts = jstParts(timestamp); const session = classifyTokyoSession(timestamp);
  const closeMinutes = session === "MORNING" ? 11 * 60 + 30 : session === "AFTERNOON" ? 15 * 60 + 30 : null;
  if (closeMinutes === null) return null;
  return Date.UTC(parts.year, parts.month, parts.day, Math.floor(closeMinutes / 60) - 9, closeMinutes % 60) / 1_000;
}

export function candleCompletedAt(candle: TechnicalCandle, timeframe: TechnicalTimeframe,
  nextCandle?: TechnicalCandle): number | null {
  if (!isValidTechnicalCandle(candle)) return null;
  if (nextCandle && isValidTechnicalCandle(nextCandle) && nextCandle.time > candle.time) return nextCandle.time;
  const duration = durationSeconds[timeframe];
  if (duration) {
    const normalEnd = candle.time + duration; const close = sessionClose(candle.time);
    return close === null ? normalEnd : Math.min(normalEnd, close);
  }
  if (timeframe === "1D") {
    const parts = jstParts(candle.time);
    return Date.UTC(parts.year, parts.month, parts.day, 15 - 9, 30) / 1_000;
  }
  return null;
}

export function isCompletedCandle(candle: TechnicalCandle, timeframe: TechnicalTimeframe,
  asOfTimestamp: number, nextCandle?: TechnicalCandle) {
  const completedAt = candleCompletedAt(candle, timeframe, nextCandle);
  return completedAt !== null && Number.isFinite(asOfTimestamp) && completedAt <= asOfTimestamp;
}

export function canonicalizeCandleTimeline(candles: readonly TechnicalCandle[], timeframe: TechnicalTimeframe): CanonicalTimeline {
  const valid = candles.filter(isValidTechnicalCandle).map((item) => ({ ...item }));
  const rejectedCount = candles.length - valid.length;
  valid.sort((left, right) => left.time - right.time || left.open - right.open || left.close - right.close);
  const unique: TechnicalCandle[] = []; let duplicateCount = 0;
  for (const candle of valid) {
    if (unique.at(-1)?.time === candle.time) { duplicateCount += 1; continue; }
    unique.push(candle);
  }
  let missingBarCount = 0; let overnightGapCount = 0; const duration = durationSeconds[timeframe];
  for (let index = 1; index < unique.length; index += 1) {
    const previous = unique[index - 1]; const current = unique[index];
    if (!sameJstDate(previous.time, current.time)) { overnightGapCount += 1; continue; }
    if (!duration) continue;
    const previousSession = classifyTokyoSession(previous.time); const currentSession = classifyTokyoSession(current.time);
    if (previousSession === currentSession && (previousSession === "MORNING" || previousSession === "AFTERNOON")
      && current.time - previous.time > duration) missingBarCount += Math.max(1, Math.floor((current.time - previous.time) / duration) - 1);
  }
  return { candles: unique, rejectedCount, duplicateCount, missingBarCount, overnightGapCount };
}

export function completedCandlesAsOf(candles: readonly TechnicalCandle[], timeframe: TechnicalTimeframe,
  asOfTimestamp: number) {
  const timeline = canonicalizeCandleTimeline(candles.filter((candle) => candle.time <= asOfTimestamp), timeframe);
  return { ...timeline, candles: timeline.candles.filter((candle, index, all) =>
    isCompletedCandle(candle, timeframe, asOfTimestamp, all[index + 1])) };
}

export function assessTimeframeQuality(input: { capability: TimeframeCapability; timeline: CanonicalTimeline;
  asOfTimestamp: number; staleAfterSeconds: number; minimumCandles: number }): MultiTimeframeDataQuality {
  if (input.capability.availability === "UNAVAILABLE") return "UNAVAILABLE";
  if (input.timeline.rejectedCount > 0 || input.timeline.candles.length === 0) return "INVALID";
  const last = input.timeline.candles.at(-1)!;
  if (input.asOfTimestamp - last.time > input.staleAfterSeconds) return "STALE";
  if (input.timeline.candles.length < input.minimumCandles || input.timeline.missingBarCount > 0) return "PARTIAL";
  return "COMPLETE";
}

export function getTimeframeCapability(timeframe: TechnicalTimeframe) {
  return TIMEFRAME_CAPABILITIES.find((item) => item.timeframe === timeframe)!;
}
