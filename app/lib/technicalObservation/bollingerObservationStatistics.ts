import { normalizeDateOnly } from "./bollingerObservationPersistence.ts";
import type {
  BollingerObservationStatistics,
  BollingerStatisticsFilter,
  BollingerStatisticsRow,
} from "./bollingerObservationStatisticsTypes.ts";

const FILTER_RANGES = [
  ["rsiMin", "rsiMax"], ["macdHistogramMin", "macdHistogramMax"],
  ["ema20Min", "ema20Max"], ["ema75Min", "ema75Max"],
  ["ema200Min", "ema200Max"], ["volumeRatioMin", "volumeRatioMax"],
] as const;

export function validateBollingerStatisticsFilter(filter: BollingerStatisticsFilter) {
  if (filter.timeframe !== "1D") throw new Error("UNSUPPORTED_STATISTICS_TIMEFRAME");
  if (!(["LOWER", "UPPER"] as const).includes(filter.side)) throw new Error("INVALID_STATISTICS_SIDE");
  if (!([2, 3] as const).includes(filter.sigmaLevel)) throw new Error("INVALID_STATISTICS_SIGMA_LEVEL");
  if (!(["TOUCH", "CROSS", "CONTINUATION", "RETURN_INSIDE"] as const).includes(filter.eventType)) {
    throw new Error("INVALID_STATISTICS_EVENT_TYPE");
  }
  if (!([1, 3, 5] as const).includes(filter.horizon)) throw new Error("INVALID_STATISTICS_HORIZON");
  if (filter.detectorVersion !== "BB_OBSERVATION_V1") throw new Error("INVALID_STATISTICS_DETECTOR_VERSION");
  if (filter.resultVersion !== "BB_OBSERVATION_RESULT_V1") throw new Error("INVALID_STATISTICS_RESULT_VERSION");
  if (filter.fromDate !== undefined && !normalizeDateOnly(filter.fromDate)) throw new Error("INVALID_FROM_DATE");
  if (filter.toDate !== undefined && !normalizeDateOnly(filter.toDate)) throw new Error("INVALID_TO_DATE");
  if (filter.fromDate && filter.toDate && filter.fromDate > filter.toDate) throw new Error("INVALID_DATE_RANGE");
  if (filter.code !== undefined && !filter.code.trim()) throw new Error("INVALID_STATISTICS_CODE");
  const numericKeys = FILTER_RANGES.flatMap(([min, max]) => [min, max]);
  for (const key of numericKeys) {
    const value = filter[key];
    if (value !== undefined && !Number.isFinite(value)) throw new Error(`INVALID_STATISTICS_FILTER:${key}`);
  }
  for (const [minKey, maxKey] of FILTER_RANGES) {
    const min = filter[minKey]; const max = filter[maxKey];
    if (min !== undefined && max !== undefined && min > max) throw new Error(`INVALID_STATISTICS_RANGE:${minKey}`);
  }
  if (filter.macdCross !== undefined
    && !(["GOLDEN_CROSS", "DEAD_CROSS"] as const).includes(filter.macdCross)) {
    throw new Error("INVALID_MACD_CROSS_FILTER");
  }
  if (filter.minimumSampleThreshold !== undefined
    && (!Number.isInteger(filter.minimumSampleThreshold) || filter.minimumSampleThreshold < 1)) {
    throw new Error("INVALID_MINIMUM_SAMPLE_THRESHOLD");
  }
}

function average(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values: readonly number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calculateBollingerObservationStatistics(
  filter: BollingerStatisticsFilter,
  rows: readonly BollingerStatisticsRow[],
): BollingerObservationStatistics {
  validateBollingerStatisticsFilter(filter);
  const seen = new Set<number>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.eventId) || row.eventId <= 0) throw new Error("INVALID_STATISTICS_EVENT_ID");
    if (seen.has(row.eventId)) throw new Error("DUPLICATE_EVENT_ROW");
    seen.add(row.eventId);
    const values = [row.rawReturn, row.maxRise, row.maxDrawdown];
    if (values.some((value) => value !== null && !Number.isFinite(value))) {
      throw new Error("INVALID_STATISTICS_RESULT_VALUE");
    }
    const completedFields = values.filter((value) => value !== null).length;
    if (completedFields !== 0 && completedFields !== 3) throw new Error("PARTIAL_STATISTICS_RESULT_ROW");
  }
  const completed = rows.flatMap((row) => row.rawReturn !== null
    && row.maxRise !== null && row.maxDrawdown !== null
    ? [{ eventId: row.eventId, rawReturn: row.rawReturn,
      maxRise: row.maxRise, maxDrawdown: row.maxDrawdown }]
    : []);
  const raw = completed.map((row) => row.rawReturn);
  const adjusted = raw.map((value) => filter.side === "LOWER" || value === 0 ? value : -value);
  const wins = adjusted.filter((value) => value > 0).length;
  const losses = adjusted.filter((value) => value < 0).length;
  const neutral = adjusted.length - wins - losses;
  const directional = wins + losses;
  const maxRise = completed.map((row) => row.maxRise);
  const maxDrawdown = completed.map((row) => row.maxDrawdown);
  const warnings: Array<"SMALL_SAMPLE"> = [];
  if (filter.minimumSampleThreshold !== undefined && completed.length < filter.minimumSampleThreshold) {
    warnings.push("SMALL_SAMPLE");
  }
  return {
    filter: { ...filter }, sampleCount: rows.length, completedSampleCount: completed.length,
    pendingSampleCount: rows.length - completed.length, winCount: wins, lossCount: losses,
    neutralCount: neutral, winRate: directional ? wins / directional * 100 : null,
    averageRawReturn: average(raw), medianRawReturn: median(raw),
    averageAdjustedReturn: average(adjusted), medianAdjustedReturn: median(adjusted),
    minAdjustedReturn: adjusted.length ? Math.min(...adjusted) : null,
    maxAdjustedReturn: adjusted.length ? Math.max(...adjusted) : null,
    averageMaxRise: average(maxRise), averageMaxDrawdown: average(maxDrawdown),
    worstMaxDrawdown: maxDrawdown.length ? Math.min(...maxDrawdown) : null, warnings,
  };
}
