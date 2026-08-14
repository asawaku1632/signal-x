import type { BollingerSignal } from "@/app/lib/bollingerBands";

export const BB_EVALUATION_HORIZONS = [1, 5, 10, 20] as const;
export const BB_SIGNAL_BATCH_SIZE = 250;
export const BB_EVALUATION_MAX_EVENTS = 40;
export const BB_EVALUATION_CONCURRENCY = 4;
export const BB_EVALUATION_REQUEST_TIMEOUT_MS = 8_000;
export const BB_EVALUATION_TIME_BUDGET_MS = 100_000;
export type BbEvaluationHorizon = (typeof BB_EVALUATION_HORIZONS)[number];

export type BbSignalState = {
  side: string;
  status: string;
  upperRegime: string;
  active: boolean;
};

export type TradingCandle = { tradeDate: string; close: number };

export function chunkBbItems<T>(items: readonly T[], batchSize = BB_SIGNAL_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError("BB signal batch size must be a positive integer");
  }
  const batches: T[][] = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    batches.push(items.slice(offset, offset + batchSize));
  }
  return batches;
}

export function findDuplicateCodes(codes: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const code of codes) {
    if (seen.has(code)) duplicates.add(code);
    seen.add(code);
  }
  return Array.from(duplicates);
}

export function clampBbEvaluationOptions(options: {
  limit?: number;
  concurrency?: number;
  requestTimeoutMs?: number;
  timeBudgetMs?: number;
}) {
  return {
    limit: Math.min(BB_EVALUATION_MAX_EVENTS, Math.max(1, Math.floor(
      options.limit ?? BB_EVALUATION_MAX_EVENTS,
    ))),
    concurrency: Math.min(5, Math.max(1, Math.floor(
      options.concurrency ?? BB_EVALUATION_CONCURRENCY,
    ))),
    requestTimeoutMs: Math.min(10_000, Math.max(
      1_000,
      options.requestTimeoutMs ?? BB_EVALUATION_REQUEST_TIMEOUT_MS,
    )),
    timeBudgetMs: Math.min(110_000, Math.max(
      1_000,
      options.timeBudgetMs ?? BB_EVALUATION_TIME_BUDGET_MS,
    )),
  };
}

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
