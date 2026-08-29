export type BollingerStatisticsFilter = {
  timeframe: "1D";
  side: "LOWER" | "UPPER";
  sigmaLevel: 2 | 3;
  eventType: "TOUCH" | "CROSS" | "CONTINUATION" | "RETURN_INSIDE";
  horizon: 1 | 3 | 5;
  detectorVersion: "BB_OBSERVATION_V1";
  resultVersion: "BB_OBSERVATION_RESULT_V1";
  fromDate?: string;
  toDate?: string;
  code?: string;
  rsiMin?: number;
  rsiMax?: number;
  macdCross?: "GOLDEN_CROSS" | "DEAD_CROSS";
  macdHistogramMin?: number;
  macdHistogramMax?: number;
  ema20Min?: number;
  ema20Max?: number;
  ema75Min?: number;
  ema75Max?: number;
  ema200Min?: number;
  ema200Max?: number;
  volumeRatioMin?: number;
  volumeRatioMax?: number;
  minimumSampleThreshold?: number;
};

export type BollingerStatisticsRow = {
  eventId: number;
  rawReturn: number | null;
  maxRise: number | null;
  maxDrawdown: number | null;
};

export type BollingerObservationStatistics = {
  filter: BollingerStatisticsFilter;
  sampleCount: number;
  completedSampleCount: number;
  pendingSampleCount: number;
  winCount: number;
  lossCount: number;
  neutralCount: number;
  winRate: number | null;
  averageRawReturn: number | null;
  medianRawReturn: number | null;
  averageAdjustedReturn: number | null;
  medianAdjustedReturn: number | null;
  minAdjustedReturn: number | null;
  maxAdjustedReturn: number | null;
  averageMaxRise: number | null;
  averageMaxDrawdown: number | null;
  /** Worst individual-event excursion; this is not portfolio maximum drawdown. */
  worstMaxDrawdown: number | null;
  warnings: Array<"SMALL_SAMPLE">;
};
