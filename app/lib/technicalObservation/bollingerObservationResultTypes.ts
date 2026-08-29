import type { BollingerObservationSide, BollingerObservationTimeframe } from "./bollingerObservationTypes.ts";

export const BOLLINGER_RESULT_HORIZONS = [1, 3, 5] as const;
export type BollingerResultHorizon = (typeof BOLLINGER_RESULT_HORIZONS)[number];

export type BollingerResultSnapshot = {
  timeframe: BollingerObservationTimeframe;
  close: number;
  observationDate: string;
  barEndAt: string | Date;
};

export type BollingerResultEvent = {
  eventId: number;
  side: BollingerObservationSide;
  sigmaLevel: 2 | 3;
  eventType: "TOUCH" | "CROSS" | "CONTINUATION" | "RETURN_INSIDE";
};

export type BollingerFutureDailyCandle = {
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type BollingerCompletedFutureResult = {
  horizon: BollingerResultHorizon;
  horizonUnit: "TRADING_DAY";
  entryPrice: number;
  futureClose: number;
  returnPercent: number;
  maxRisePercent: number;
  maxDrawdownPercent: number;
  maxRiseTradeDate: string;
  maxDrawdownTradeDate: string;
  evaluatedTradeDate: string;
  windowCandleCount: BollingerResultHorizon;
  resultQuality: "COMPLETE";
  resultVersion: "BB_OBSERVATION_RESULT_V1";
};

export type BollingerFutureEvaluation = {
  completed: BollingerCompletedFutureResult[];
  notYetEvaluable: BollingerResultHorizon[];
};
