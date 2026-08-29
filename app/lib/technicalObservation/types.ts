import type { PatternDirection } from "../chartPatternEngine.ts";

export const TECHNICAL_TIMEFRAMES = ["5M", "15M", "1H", "1D", "1W", "1M"] as const;

export type TechnicalTimeframe = (typeof TECHNICAL_TIMEFRAMES)[number];

export type TechnicalCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IntradayObservationTimes = {
  scheduledAt: number | null;
  requestedAt: number;
  receivedAt: number;
  observedAt: number;
  providerTimestamp: number | null;
};

export const PHASE2A_SHADOW_POLICY = {
  mode: "SHADOW_ONLY",
  productionEnabled: false,
  decisionOutputEnabled: false,
  notificationEnabled: false,
  databaseProductionEnabled: false,
} as const;

export type DatasetStatus =
  | "COMPLETE"
  | "INCOMPLETE"
  | "INSUFFICIENT_HISTORY"
  | "STALE"
  | "EMPTY"
  | "INVALID";

export type CandleDataset = {
  timeframe: TechnicalTimeframe;
  source: string;
  range: string;
  interval: string;
  sessionDate?: string;
  firstBarAt: string | null;
  lastBarAt: string | null;
  candleCount: number;
  status: DatasetStatus;
  complete: boolean;
  completenessReason?: string;
  candles: TechnicalCandle[];
};

export type IndicatorSnapshot = {
  timeframe: TechnicalTimeframe;
  tradeDate: string;
  barEndAt: string;
  candleCount: number;
  datasetStatus: DatasetStatus;
  complete: boolean;
  price: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  ma: {
    sma5: number | null;
    sma20: number | null;
    sma60: number | null;
    ema5: number | null;
    ema20: number | null;
    ema75: number | null;
    ema200: number | null;
  };
  momentum: {
    rsi14: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
  };
  volatility: {
    atr14: number | null;
  };
  volume: {
    ratio: number | null;
  };
};

export type PatternSnapshot = {
  patternId: string;
  name: string;
  direction: PatternDirection;
  confidence: number;
  score: number;
  reasons: string[];
  engineVersion: string;
  timeframe: TechnicalTimeframe;
  barEndAt: string;
  candleCount: number;
};

export type ObservationGroup = "SIGNAL" | "WEAK" | "UNCONFIRMED" | "CONTROL";
export type TechnicalDirection = "UP" | "DOWN" | "NEUTRAL";

export type TimeframedObservationMetadata = {
  daily: Record<string, unknown>;
  intraday5m?: Record<string, unknown>;
  [key: string]: unknown;
};

export type TechnicalSignalCandidate = {
  signalType: string;
  signalSubtype: string | null;
  signalKey: string;
  timeframe: TechnicalTimeframe;
  contextTimeframe?: TechnicalTimeframe;
  direction: TechnicalDirection;
  observationGroup: ObservationGroup;
  strengthBucket?: string;
  entryPrice: number;
  /** Detector condition-fulfilment score. This is not a probability of a price move. */
  confidence?: number;
  detectorVersion: string;
  metadata: TimeframedObservationMetadata;
};

export type TechnicalObservationContext = {
  code: string;
  name: string;
  tradeDate: string;
  daily: {
    dataset: CandleDataset & { timeframe: "1D" };
    indicators: IndicatorSnapshot & { timeframe: "1D" };
  };
  intraday5m?: {
    dataset: CandleDataset & { timeframe: "5M" };
    indicators?: IndicatorSnapshot & { timeframe: "5M" };
  };
  patterns?: PatternSnapshot[];
  aiPowerSnapshot?: {
    raw: number;
    display: number;
  };
};

export interface TechnicalSignalDetector {
  readonly signalType: string;
  readonly detectorVersion: string;
  detect(context: TechnicalObservationContext): TechnicalSignalCandidate | null;
}

export type TechnicalSignalState = {
  active: boolean;
  signalSubtype: string | null;
  direction: TechnicalDirection;
  strengthBucket?: string;
  detectorVersion: string;
};
