import type { BollingerSignal } from "@/app/lib/bollingerBands";

export const BB_EVALUATION_HORIZONS = [1, 5, 10, 20] as const;
export type BbEvaluationHorizon = (typeof BB_EVALUATION_HORIZONS)[number];

export type BbSignalState = {
  side: string;
  status: string;
  upperRegime: string;
  active: boolean;
};

export type TradingCandle = { tradeDate: string; close: number };

export function getObservationState(signal?: BollingerSignal): BbSignalState {
  if (!signal || signal.side === "NONE" || signal.status === "NONE") {
    return { side: "NONE", status: "NONE", upperRegime: "NONE", active: false };
  }
  return {
    side: signal.side,
    status: signal.status,
    upperRegime: signal.upperRegime ?? "NONE",
    active: true,
  };
}

export function shouldCreateBbEvent(
  previous: BbSignalState | undefined,
  current: BbSignalState,
) {
  if (!current.active) return false;
  if (!previous?.active) return true;
  return previous.side !== current.side ||
    previous.status !== current.status ||
    previous.upperRegime !== current.upperRegime;
}

export function getFutureTradingEvaluation(
  candles: TradingCandle[],
  signalDate: string,
  horizon: BbEvaluationHorizon,
  entryPrice: number,
) {
  const signalIndex = candles.findIndex((candle) => candle.tradeDate === signalDate);
  const future = signalIndex >= 0 ? candles[signalIndex + horizon] : undefined;
  if (!future || !Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  return {
    horizon,
    futurePrice: future.close,
    returnPercent: ((future.close / entryPrice) - 1) * 100,
    evaluatedTradeDate: future.tradeDate,
  };
}
