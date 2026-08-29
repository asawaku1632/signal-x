import { fetchDailyCandleDatasets } from "./dailyData.ts";
import { DAILY_DATASET_REQUIREMENTS } from "./datasets.ts";
import { completedCandlesAsOf } from "./timeframeFoundation.ts";
import { evaluateBollingerObservationFuture, resultsForBollingerEvent } from "./bollingerObservationResultEvaluator.ts";
import { saveBollingerObservationResults, type BollingerResultDatabase } from "./bollingerObservationResultPersistence.ts";
import { normalizeDateOnly } from "./bollingerObservationPersistence.ts";
import type { BollingerFutureDailyCandle } from "./bollingerObservationResultTypes.ts";
import type { CandleDataset } from "./types.ts";
import type { BollingerRunnerMode } from "./bollingerObservationRunner.ts";
import { isTseTargetDateReady, resolveTseTradingDatesAfter,
  TSE_MARKET_CALENDAR_VERSION } from "./tseMarketCalendar.ts";

type QueryResult = { rows: Record<string, unknown>[] };
export type BollingerResultRunnerDatabase = BollingerResultDatabase & {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
};
export type PendingBollingerEvent = { eventId: number; code: string; timeframe: "1D" | "1W";
  side: "LOWER" | "UPPER"; sigmaLevel: 2 | 3; eventType: "TOUCH" | "CROSS" | "CONTINUATION" | "RETURN_INSIDE";
  close: number; observationDate: string; barEndAt: string | Date };

export type BollingerResultCalendarResolution = {
  observationDate: string;
  tradingDates: readonly [string, string, string, string, string];
  h1TargetTradeDate: string;
  h3TargetTradeDate: string;
  h5TargetTradeDate: string;
  marketCalendarVersion: string;
};

type ResultHorizonCalendarDiagnostic = {
  horizon: 1 | 3 | 5;
  expectedDate: string;
  actualCandleDate: string | null;
  ready: boolean;
  failureKind: "TARGET_CANDLE_NOT_READY" | "TARGET_CANDLE_MISSING" | null;
};

export type BollingerResultRunnerOptions = {
  mode?: BollingerRunnerMode; limit: number; concurrency?: number; timeoutMs?: number; now?: Date;
  database?: BollingerResultRunnerDatabase;
  selectEvents?: (limit: number) => Promise<PendingBollingerEvent[]>;
  fetchBatch?: (codes: readonly string[], options: { concurrency?: number; timeoutMs?: number;
    nowMs: number }) => Promise<Awaited<ReturnType<typeof fetchDailyCandleDatasets>>>;
  persist?: typeof saveBollingerObservationResults;
  stopOnCanonicalMismatch?: boolean;
};

function validateOptions(options: BollingerResultRunnerOptions) {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) throw new Error("INVALID_RESULT_RUNNER_LIMIT");
  if (options.mode !== undefined && !(["PREVIEW", "SAVE"] as const).includes(options.mode)) {
    throw new Error("INVALID_RESULT_RUNNER_MODE");
  }
}

function tradeDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric",
    month: "2-digit", day: "2-digit" }).format(new Date(timestamp * 1_000));
}

export function resolveBollingerResultCalendar(observationDate: string): BollingerResultCalendarResolution {
  const normalized = normalizeDateOnly(observationDate);
  if (!normalized) throw new Error("INVALID_OBSERVATION_DATE");
  const dates = resolveTseTradingDatesAfter(normalized, 5);
  if (dates.length !== 5) throw new Error("TARGET_TRADE_DATE_UNRESOLVED");
  const tradingDates = dates as [string, string, string, string, string];
  return { observationDate: normalized, tradingDates,
    h1TargetTradeDate: tradingDates[0], h3TargetTradeDate: tradingDates[2],
    h5TargetTradeDate: tradingDates[4], marketCalendarVersion: TSE_MARKET_CALENDAR_VERSION };
}

export function inspectBollingerResultCalendar(observationDate: string,
  future: readonly BollingerFutureDailyCandle[], now: Date) {
  const calendar = resolveBollingerResultCalendar(observationDate);
  const horizons: ResultHorizonCalendarDiagnostic[] = ([1, 3, 5] as const).map((horizon) => {
    const expectedDate = calendar.tradingDates[horizon - 1];
    const actualCandleDate = future[horizon - 1]?.tradeDate ?? null;
    const boundaryReady = isTseTargetDateReady(expectedDate, now);
    const ready = boundaryReady && actualCandleDate === expectedDate;
    return { horizon, expectedDate, actualCandleDate, ready,
      failureKind: ready ? null : boundaryReady ? "TARGET_CANDLE_MISSING" : "TARGET_CANDLE_NOT_READY" };
  });
  return { calendar, horizons };
}

export function futureCandlesFromDataset(dataset: CandleDataset, event: PendingBollingerEvent,
  now: Date): BollingerFutureDailyCandle[] | null {
  if (event.timeframe !== "1D" || dataset.timeframe !== "1D" || dataset.status !== "COMPLETE") return null;
  const calendar = resolveBollingerResultCalendar(event.observationDate);
  const completed = completedCandlesAsOf(dataset.candles, "1D", now.getTime() / 1_000);
  if (completed.rejectedCount > 0 || completed.duplicateCount > 0) return null;
  const dated = completed.candles.map((candle) => ({ candle, tradeDate: tradeDate(candle.time) }));
  if (!dated.some((item) => item.tradeDate === event.observationDate)) return null;
  const expected = new Set(calendar.tradingDates);
  const withinHorizon = dated.filter((item) => item.tradeDate > event.observationDate
    && item.tradeDate <= calendar.h5TargetTradeDate);
  if (withinHorizon.some((item) => !expected.has(item.tradeDate))) {
    throw new Error("RESULT_PROVIDER_CALENDAR_MISMATCH");
  }
  const byDate = new Map(withinHorizon.map((item) => [item.tradeDate, item.candle]));
  const resolved: BollingerFutureDailyCandle[] = [];
  for (const expectedDate of calendar.tradingDates) {
    if (!isTseTargetDateReady(expectedDate, now)) break;
    const candle = byDate.get(expectedDate);
    if (!candle) break;
    resolved.push({ tradeDate: expectedDate, open: candle.open, high: candle.high,
      low: candle.low, close: candle.close });
  }
  return resolved;
}

async function defaultDatabase(): Promise<BollingerResultRunnerDatabase> {
  const { default: pool } = await import("../postgres.ts");
  return pool as unknown as BollingerResultRunnerDatabase;
}

export async function selectPendingBollingerEvents(database: BollingerResultRunnerDatabase, limit: number) {
  const result = await database.query(
    `SELECT e.id event_id,e.side,e.sigma_level,e.event_type,s.code,s.timeframe,s.close,
            s.observation_date,s.bar_end_at
       FROM technical_bb_observation_events e
       JOIN technical_bb_observation_snapshots s ON s.id=e.snapshot_id
      WHERE s.timeframe='1D' AND s.detector_version='BB_OBSERVATION_V1'
        AND EXISTS (SELECT 1 FROM unnest(ARRAY[1,3,5]) h
          WHERE NOT EXISTS (SELECT 1 FROM technical_bb_observation_results r
            WHERE r.event_id=e.id AND r.horizon=h AND r.horizon_unit='TRADING_DAY'
              AND r.result_version='BB_OBSERVATION_RESULT_V1' AND r.result_quality='COMPLETE'))
      ORDER BY s.observation_date,e.id LIMIT $1`, [limit]);
  return result.rows.map((row) => ({ eventId: Number(row.event_id), code: String(row.code),
    timeframe: String(row.timeframe) as "1D", side: String(row.side) as "LOWER" | "UPPER",
    sigmaLevel: Number(row.sigma_level) as 2 | 3, eventType: String(row.event_type) as PendingBollingerEvent["eventType"],
    close: Number(row.close), observationDate: normalizeDateOnly(row.observation_date) ?? "INVALID_DATE",
    barEndAt: row.bar_end_at as string | Date }));
}

export async function runBollingerResultBatch(options: BollingerResultRunnerOptions) {
  validateOptions(options); const mode = options.mode ?? "PREVIEW"; const now = options.now ?? new Date();
  const database = options.database ?? await defaultDatabase();
  const events = options.selectEvents ? await options.selectEvents(options.limit)
    : await selectPendingBollingerEvents(database, options.limit);
  const codes = Array.from(new Set(events.map((event) => event.code)));
  const batch = options.fetchBatch
    ? await options.fetchBatch(codes, { concurrency: options.concurrency, timeoutMs: options.timeoutMs, nowMs: now.getTime() })
    : await fetchDailyCandleDatasets(codes, "LONG_300", DAILY_DATASET_REQUIREMENTS.RECENT_RANGE_20,
      { concurrency: options.concurrency, timeoutMs: options.timeoutMs, nowMs: now.getTime() });
  const datasets = new Map<string, CandleDataset>(); const fetchFailures = new Set<string>();
  batch.settled.forEach((settled, index) => settled.status === "fulfilled"
    ? datasets.set(settled.value.code, settled.value.dataset) : fetchFailures.add(codes[index]));
  let evaluatedEvents = 0; let candidateResults = 0; let resultsCreated = 0; let resultsExisting = 0;
  let unavailableEvents = 0; let failedEvents = 0;
  const outcomes: Array<{ eventId: number; code: string; status: string; completedHorizons?: number[]; reason?: string;
    calendar?: BollingerResultCalendarResolution; calendarDiagnostics?: ResultHorizonCalendarDiagnostic[] }> = [];
  for (const event of events) {
    if (event.timeframe !== "1D") { failedEvents += 1; outcomes.push({ eventId: event.eventId, code: event.code,
      status: "UNSUPPORTED", reason: "UNSUPPORTED_RESULT_TIMEFRAME" }); continue; }
    const calendar = resolveBollingerResultCalendar(event.observationDate);
    if (fetchFailures.has(event.code)) { failedEvents += 1; outcomes.push({ eventId: event.eventId, code: event.code,
      status: "FETCH_FAILED", reason: "DAILY_FETCH_FAILED", calendar }); continue; }
    const dataset = datasets.get(event.code); const future = dataset
      ? futureCandlesFromDataset(dataset, event, now) : null;
    if (!future) { unavailableEvents += 1; outcomes.push({ eventId: event.eventId, code: event.code,
      status: "RESULT_DATA_UNAVAILABLE", reason: "OBSERVATION_OUTSIDE_DATASET", calendar }); continue; }
    const calendarDiagnostics = inspectBollingerResultCalendar(event.observationDate, future, now).horizons;
    try {
      const evaluation = evaluateBollingerObservationFuture({ timeframe: "1D", close: event.close,
        observationDate: event.observationDate, barEndAt: event.barEndAt }, future);
      const results = resultsForBollingerEvent(event, evaluation);
      evaluatedEvents += 1; candidateResults += results.length;
      if (!results.length) { unavailableEvents += 1; outcomes.push({ eventId: event.eventId, code: event.code,
        status: "NO_RESULT_AVAILABLE", completedHorizons: [], calendar, calendarDiagnostics }); continue; }
      if (mode === "SAVE") {
        const saved = await (options.persist ?? saveBollingerObservationResults)(results, { database });
        resultsCreated += saved.created; resultsExisting += saved.existing;
      }
      outcomes.push({ eventId: event.eventId, code: event.code, status: "SUCCESS",
        completedHorizons: results.map((result) => result.horizon), calendar, calendarDiagnostics });
    } catch (error) {
      failedEvents += 1; const message = error instanceof Error ? error.message : "RESULT_EVALUATION_FAILED";
      if (options.stopOnCanonicalMismatch && message.startsWith("CANONICAL_RESULT_MISMATCH")) throw error;
      outcomes.push({ eventId: event.eventId, code: event.code, status: "EVALUATION_FAILED",
        reason: message.startsWith("CANONICAL_RESULT_MISMATCH") ? message : "RESULT_EVALUATION_FAILED",
        calendar, calendarDiagnostics });
    }
  }
  return { mode, requestedEvents: events.length, processedEvents: events.length, uniqueSymbols: codes.length,
    evaluatedEvents, unavailableEvents, failedEvents, candidateResults, resultsCreated, resultsExisting,
    outcomes, resultCalendarDiagnostics: outcomes.slice(0, 20).map((outcome) => ({ eventId: outcome.eventId,
      code: outcome.code, observationDate: outcome.calendar?.observationDate ?? null,
      h1TargetTradeDate: outcome.calendar?.h1TargetTradeDate ?? null,
      h3TargetTradeDate: outcome.calendar?.h3TargetTradeDate ?? null,
      h5TargetTradeDate: outcome.calendar?.h5TargetTradeDate ?? null,
      marketCalendarVersion: outcome.calendar?.marketCalendarVersion ?? null,
      horizons: outcome.calendarDiagnostics ?? [] })),
    resultCalendarDiagnosticsTruncated: outcomes.length > 20, maxConcurrency: batch.concurrency };
}
