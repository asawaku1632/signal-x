import type { ConfirmationEvidence } from "./evidenceTypes.ts";

export const BOLLINGER_OBSERVATION_PERIOD = 20 as const;
export const BOLLINGER_OBSERVATION_DETECTOR_VERSION = "BB_OBSERVATION_V1" as const;
export const BOLLINGER_OBSERVATION_RESULT_VERSION = "BB_OBSERVATION_RESULT_V1" as const;
export const BOLLINGER_EVENT_SIGMA_LEVELS = [2, 3] as const;
export const BOLLINGER_OBSERVATION_TIMEFRAMES = ["1D", "1W"] as const;

export type BollingerObservationTimeframe =
  (typeof BOLLINGER_OBSERVATION_TIMEFRAMES)[number];
export type BollingerObservationSide = "LOWER" | "UPPER";
export type BollingerSigmaLevel = (typeof BOLLINGER_EVENT_SIGMA_LEVELS)[number];
export type BollingerEventType =
  | "TOUCH"
  | "CROSS"
  | "CONTINUATION"
  | "RETURN_INSIDE";
export type BollingerQualityReason =
  | "INSUFFICIENT_HISTORY"
  | "ZERO_DEVIATION"
  | "INVALID_PRICE"
  | "NON_FINITE_INPUT";

export type NullableBollingerBands = {
  bbMiddle: number | null;
  standardDeviation: number | null;
  bbUpper1: number | null;
  bbUpper2: number | null;
  bbUpper3: number | null;
  bbLower1: number | null;
  bbLower2: number | null;
  bbLower3: number | null;
  bbSigmaPosition: number | null;
};

export type BollingerObservationCalculation = NullableBollingerBands & {
  period: typeof BOLLINGER_OBSERVATION_PERIOD;
  timeframe: BollingerObservationTimeframe;
  reason: BollingerQualityReason | null;
};

export type BollingerEventCandle = {
  close: number;
  high: number;
  low: number;
};

export type BollingerEventBands = {
  lower2: number;
  lower3: number;
  upper2: number;
  upper3: number;
};

export type BollingerObservationEvent = {
  type: BollingerEventType;
  side: BollingerObservationSide;
  sigmaLevel: BollingerSigmaLevel;
};

export type BollingerEvidenceIndicator =
  | "RSI"
  | "MACD"
  | "EMA"
  | "ATR"
  | "VOLUME_RATIO";

export const BOLLINGER_EVIDENCE_AVAILABILITIES = [
  "AVAILABLE", "UNAVAILABLE", "INSUFFICIENT_HISTORY", "INVALID",
] as const;

export type BollingerEvidenceAvailability =
  (typeof BOLLINGER_EVIDENCE_AVAILABILITIES)[number];

type AvailableValue<T> = {
  availability: BollingerEvidenceAvailability;
  value: T;
  reason: string | null;
};

export type BollingerObservationIndicatorValues = {
  rsi: AvailableValue<number | null>;
  macd: AvailableValue<{ macd: number | null; signal: number | null;
    histogram: number | null; cross: "GOLDEN_CROSS" | "DEAD_CROSS" | null }>;
  ema: AvailableValue<{ ema20: number | null; ema75: number | null; ema200: number | null }>;
  atr: AvailableValue<number | null>;
  volumeRatio: AvailableValue<number | null>;
};

export type BollingerObservationEvidence = {
  available: boolean;
  reason: "UNAVAILABLE_INDICATOR" | null;
  evidence: ConfirmationEvidence[];
  byIndicator: Record<BollingerEvidenceIndicator, ConfirmationEvidence[]>;
  macdCross: "GOLDEN_CROSS" | "DEAD_CROSS" | null;
  indicators: BollingerObservationIndicatorValues;
  diagnostics: Partial<Record<BollingerEvidenceIndicator, string>>;
};
