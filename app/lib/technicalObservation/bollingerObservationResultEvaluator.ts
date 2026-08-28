import { isValidTechnicalCandle } from "./candleMetrics.ts";
import { normalizeDateOnly } from "./bollingerObservationPersistence.ts";
import { BOLLINGER_OBSERVATION_RESULT_VERSION } from "./bollingerObservationTypes.ts";
import {
  BOLLINGER_RESULT_HORIZONS,
  type BollingerCompletedFutureResult,
  type BollingerFutureDailyCandle,
  type BollingerFutureEvaluation,
  type BollingerResultEvent,
  type BollingerResultSnapshot,
} from "./bollingerObservationResultTypes.ts";

function validateAndSortFutureCandles(
  candles: readonly BollingerFutureDailyCandle[],
  observationDate: string,
): BollingerFutureDailyCandle[] {
  const normalizedObservationDate = normalizeDateOnly(observationDate);
  if (!normalizedObservationDate) throw new Error("INVALID_OBSERVATION_DATE");
  const sorted = candles.map((candle) => ({ ...candle })).sort((a, b) =>
    a.tradeDate.localeCompare(b.tradeDate));
  const seen = new Set<string>();
  for (const candle of sorted) {
    const tradeDate = normalizeDateOnly(candle.tradeDate);
    if (!tradeDate) throw new Error("INVALID_FUTURE_TRADE_DATE");
    if (seen.has(tradeDate)) throw new Error("DUPLICATE_FUTURE_TRADE_DATE");
    seen.add(tradeDate);
    if (tradeDate <= normalizedObservationDate) throw new Error("FUTURE_CANDLE_NOT_AFTER_OBSERVATION");
    if (!isValidTechnicalCandle({ ...candle, time: 0, volume: 0 })) {
      throw new Error("INVALID_FUTURE_CANDLE");
    }
  }
  return sorted;
}

export function evaluateBollingerObservationFuture(
  snapshot: BollingerResultSnapshot,
  futureCandles: readonly BollingerFutureDailyCandle[],
): BollingerFutureEvaluation {
  if (snapshot.timeframe !== "1D") throw new Error("UNSUPPORTED_RESULT_TIMEFRAME");
  if (!Number.isFinite(snapshot.close) || snapshot.close <= 0) throw new Error("INVALID_ENTRY_PRICE");
  const barEndAt = snapshot.barEndAt instanceof Date ? snapshot.barEndAt : new Date(snapshot.barEndAt);
  if (!Number.isFinite(barEndAt.getTime())) throw new Error("INVALID_BAR_END_AT");
  const candles = validateAndSortFutureCandles(futureCandles, snapshot.observationDate);
  const completed: BollingerCompletedFutureResult[] = [];
  const notYetEvaluable: Array<1 | 3 | 5> = [];
  for (const horizon of BOLLINGER_RESULT_HORIZONS) {
    if (candles.length < horizon) {
      notYetEvaluable.push(horizon);
      continue;
    }
    const window = candles.slice(0, horizon);
    let maxRise = window[0];
    let maxDrawdown = window[0];
    for (const candle of window.slice(1)) {
      if (candle.high > maxRise.high) maxRise = candle;
      if (candle.low < maxDrawdown.low) maxDrawdown = candle;
    }
    const future = window[horizon - 1];
    completed.push({
      horizon,
      horizonUnit: "TRADING_DAY",
      entryPrice: snapshot.close,
      futureClose: future.close,
      returnPercent: (future.close - snapshot.close) / snapshot.close * 100,
      maxRisePercent: (maxRise.high - snapshot.close) / snapshot.close * 100,
      maxDrawdownPercent: (maxDrawdown.low - snapshot.close) / snapshot.close * 100,
      maxRiseTradeDate: maxRise.tradeDate,
      maxDrawdownTradeDate: maxDrawdown.tradeDate,
      evaluatedTradeDate: future.tradeDate,
      windowCandleCount: horizon,
      resultQuality: "COMPLETE",
      resultVersion: BOLLINGER_OBSERVATION_RESULT_VERSION,
    });
  }
  return { completed, notYetEvaluable };
}

export function resultsForBollingerEvent(
  event: BollingerResultEvent,
  evaluation: BollingerFutureEvaluation,
) {
  if (!Number.isSafeInteger(event.eventId) || event.eventId <= 0) throw new Error("INVALID_EVENT_ID");
  if (!(["LOWER", "UPPER"] as const).includes(event.side)) throw new Error("INVALID_EVENT_SIDE");
  return evaluation.completed.map((result) => ({ eventId: event.eventId, ...result }));
}
