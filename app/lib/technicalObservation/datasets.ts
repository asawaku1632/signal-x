import type {
  CandleDataset,
  DatasetStatus,
  TechnicalCandle,
  TechnicalTimeframe,
} from "./types.ts";

const DAY_MS = 86_400_000;

export type DatasetRequirement = {
  minimumCandles: number;
  recommendedCandles?: number;
  staleAfterMs?: number;
};

function isValidCandle(candle: TechnicalCandle) {
  return Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) && candle.open > 0 &&
    Number.isFinite(candle.high) && candle.high > 0 &&
    Number.isFinite(candle.low) && candle.low > 0 &&
    Number.isFinite(candle.close) && candle.close > 0 &&
    Number.isFinite(candle.volume) && candle.volume >= 0 &&
    candle.high >= Math.max(candle.open, candle.close, candle.low) &&
    candle.low <= Math.min(candle.open, candle.close, candle.high);
}

export function assessDatasetStatus(
  candles: readonly TechnicalCandle[],
  requirement: DatasetRequirement,
  nowMs = Date.now(),
): { status: DatasetStatus; reason?: string } {
  if (candles.length === 0) return { status: "EMPTY", reason: "NO_CANDLES" };
  if (!Number.isInteger(requirement.minimumCandles) || requirement.minimumCandles < 1) {
    return { status: "INVALID", reason: "INVALID_MINIMUM_CANDLES" };
  }
  if (candles.some((candle) => !isValidCandle(candle))) {
    return { status: "INVALID", reason: "INVALID_CANDLE" };
  }
  for (let index = 1; index < candles.length; index += 1) {
    if (candles[index].time <= candles[index - 1].time) {
      return { status: "INVALID", reason: "UNSORTED_OR_DUPLICATE_BARS" };
    }
  }
  if (candles.length < requirement.minimumCandles) {
    return {
      status: "INSUFFICIENT_HISTORY",
      reason: `REQUIRES_${requirement.minimumCandles}_CANDLES`,
    };
  }
  const staleAfterMs = requirement.staleAfterMs ?? 5 * DAY_MS;
  const lastBarMs = candles.at(-1)!.time * 1_000;
  if (nowMs - lastBarMs > staleAfterMs) {
    return { status: "STALE", reason: "LAST_BAR_TOO_OLD" };
  }
  if (
    requirement.recommendedCandles !== undefined &&
    candles.length < requirement.recommendedCandles
  ) {
    return {
      status: "INCOMPLETE",
      reason: `RECOMMENDS_${requirement.recommendedCandles}_CANDLES`,
    };
  }
  return { status: "COMPLETE" };
}

export function createCandleDataset(input: {
  timeframe: TechnicalTimeframe;
  source: string;
  range: string;
  interval: string;
  sessionDate?: string;
  candles: TechnicalCandle[];
  requirement: DatasetRequirement;
  nowMs?: number;
}): CandleDataset {
  const assessment = assessDatasetStatus(
    input.candles,
    input.requirement,
    input.nowMs,
  );
  const first = input.candles.at(0);
  const last = input.candles.at(-1);
  return {
    timeframe: input.timeframe,
    source: input.source,
    range: input.range,
    interval: input.interval,
    sessionDate: input.sessionDate,
    firstBarAt: first ? new Date(first.time * 1_000).toISOString() : null,
    lastBarAt: last ? new Date(last.time * 1_000).toISOString() : null,
    candleCount: input.candles.length,
    status: assessment.status,
    complete: assessment.status === "COMPLETE",
    completenessReason: assessment.reason,
    candles: input.candles,
  };
}

export const DAILY_DATASET_REQUIREMENTS = {
  RECENT_RANGE_20: { minimumCandles: 21 },
  MA_5_20_75: { minimumCandles: 75, recommendedCandles: 90 },
  EMA200_MINIMUM: { minimumCandles: 200, recommendedCandles: 260 },
  EMA200_OPERATIONAL: { minimumCandles: 260, recommendedCandles: 300 },
} as const satisfies Record<string, DatasetRequirement>;
