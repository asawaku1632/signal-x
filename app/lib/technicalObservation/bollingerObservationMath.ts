import { calculatePopulationStandardDeviation } from "../bollingerBands.ts";
import { calculateSma } from "./indicators.ts";
import {
  BOLLINGER_OBSERVATION_PERIOD,
  type BollingerObservationCalculation,
  type BollingerObservationTimeframe,
  type BollingerQualityReason,
  type NullableBollingerBands,
} from "./bollingerObservationTypes.ts";

const EMPTY_BANDS: NullableBollingerBands = {
  bbMiddle: null,
  standardDeviation: null,
  bbUpper1: null,
  bbUpper2: null,
  bbUpper3: null,
  bbLower1: null,
  bbLower2: null,
  bbLower3: null,
  bbSigmaPosition: null,
};

function failed(
  timeframe: BollingerObservationTimeframe,
  reason: BollingerQualityReason,
): BollingerObservationCalculation {
  return { period: BOLLINGER_OBSERVATION_PERIOD, timeframe, reason, ...EMPTY_BANDS };
}

export function calculateBbSigmaPosition(
  close: number | null,
  bbMiddle: number | null,
  standardDeviation: number | null,
): { value: number | null; reason: BollingerQualityReason | null } {
  if (close === null || bbMiddle === null || standardDeviation === null) {
    return { value: null, reason: "NON_FINITE_INPUT" };
  }
  if (![close, bbMiddle, standardDeviation].every(Number.isFinite)) {
    return { value: null, reason: "NON_FINITE_INPUT" };
  }
  if (close <= 0 || bbMiddle <= 0 || standardDeviation < 0) {
    return { value: null, reason: "INVALID_PRICE" };
  }
  if (standardDeviation === 0) return { value: null, reason: "ZERO_DEVIATION" };
  const value = (close - bbMiddle) / standardDeviation;
  return Number.isFinite(value)
    ? { value, reason: null }
    : { value: null, reason: "NON_FINITE_INPUT" };
}

export function calculateBollingerObservation(
  closes: readonly (number | null)[],
  timeframe: BollingerObservationTimeframe,
): BollingerObservationCalculation {
  if (closes.length < BOLLINGER_OBSERVATION_PERIOD) {
    return failed(timeframe, "INSUFFICIENT_HISTORY");
  }
  const window = closes.slice(-BOLLINGER_OBSERVATION_PERIOD);
  if (window.some((value) => value === null || !Number.isFinite(value))) {
    return failed(timeframe, "NON_FINITE_INPUT");
  }
  const finiteWindow = window as number[];
  if (finiteWindow.some((value) => value <= 0)) return failed(timeframe, "INVALID_PRICE");

  const bbMiddle = calculateSma(finiteWindow, BOLLINGER_OBSERVATION_PERIOD);
  if (bbMiddle === null || !Number.isFinite(bbMiddle) || bbMiddle <= 0) {
    return failed(timeframe, "INVALID_PRICE");
  }
  const standardDeviation = calculatePopulationStandardDeviation(finiteWindow, bbMiddle);
  if (!Number.isFinite(standardDeviation)) return failed(timeframe, "NON_FINITE_INPUT");
  const sigma = calculateBbSigmaPosition(
    finiteWindow.at(-1)!,
    bbMiddle,
    standardDeviation,
  );

  return {
    period: BOLLINGER_OBSERVATION_PERIOD,
    timeframe,
    reason: sigma.reason,
    bbMiddle,
    standardDeviation,
    bbUpper1: bbMiddle + standardDeviation,
    bbUpper2: bbMiddle + standardDeviation * 2,
    bbUpper3: bbMiddle + standardDeviation * 3,
    bbLower1: bbMiddle - standardDeviation,
    bbLower2: bbMiddle - standardDeviation * 2,
    bbLower3: bbMiddle - standardDeviation * 3,
    bbSigmaPosition: sigma.value,
  };
}

export function adjustBollingerReturn(
  side: "LOWER" | "UPPER",
  rawReturn: number,
): number | null {
  if (!Number.isFinite(rawReturn)) return null;
  return side === "LOWER" ? rawReturn : -rawReturn;
}

export function classifyAdjustedReturn(value: number): "POSITIVE" | "NEGATIVE" | "NEUTRAL" | null {
  if (!Number.isFinite(value)) return null;
  return value > 0 ? "POSITIVE" : value < 0 ? "NEGATIVE" : "NEUTRAL";
}
