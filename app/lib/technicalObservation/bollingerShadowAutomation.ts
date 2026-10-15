import { PHASE7_CODES, PHASE7_RESULT_CODES, PHASE7_PARENT_SQL, PHASE7_DUPLICATE_SQL, PHASE7_ORPHAN_SQL } from "./bollingerShadowQueries.ts";
import { validatePhase7DedicatedDestination, PHASE7_OFFLINE_DESTINATION, assertPhase7Database, Phase7SecurityError,
  PHASE7_ACQUIRE_LOCK_SQL, PHASE7_RELEASE_LOCK_SQL } from "./bollingerShadowDevSecurity.ts";
import { randomUUID, randomBytes } from "node:crypto";
import { PHASE7_CAP_ACQUIRE_SQL, PHASE7_CAP_RELEASE_SQL } from "./bollingerShadowQueries.ts";

import { ACTIVE_STOCKS } from "../activeStockList.ts";
import { DailyDataFetchError, fetchDailyCandleDatasets } from "./dailyData.ts";
import { DAILY_DATASET_REQUIREMENTS } from "./datasets.ts";
import { completedCandlesAsOf, candleCompletedAt } from "./timeframeFoundation.ts";
import { runBollingerObservationBatch, type BollingerRunnerStock } from "./bollingerObservationRunner.ts";
import { normalizeDateOnly, canonicalNumericEqual, saveBollingerObservation } from "./bollingerObservationPersistence.ts";
import { evaluateBollingerObservationFuture } from "./bollingerObservationResultEvaluator.ts";
import { futureCandlesFromDataset, inspectBollingerResultCalendar, runBollingerResultBatch, selectPendingBollingerEvents,
  type BollingerResultRunnerDatabase, type PendingBollingerEvent } from "./bollingerObservationResultRunner.ts";
import type { BollingerResultPersistenceInput } from "./bollingerObservationResultPersistence.ts";
import type { CandleDataset } from "./types.ts";

export const BOLLINGER_SHADOW_EXECUTION_SOURCE = "PHASE_7_SHADOW_AUTOMATION" as const;
export const BOLLINGER_SHADOW_DEV_PROJECT_REF = "jdtqwryiyxeuoraecorw" as const;
const OBSERVATION_LOCK_KEY = "signalx-technical-bb-shadow-observation";
const RESULTS_LOCK_KEY = "signalx-technical-bb-shadow-results";

type QueryResult = { rows: Record<string, unknown>[] };
export type BollingerShadowDatabase = BollingerResultRunnerDatabase & {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
};
type Batch = Awaited<ReturnType<typeof fetchDailyCandleDatasets>>;
type BroadFailureThreshold = { minimumAffectedSymbols: number; affectedRatio: number };

export type BollingerShadowCommonOptions = {
  mode: "PREVIEW" | "SAVE";
  limit: number;
  targetTradeDate: string;
  now?: Date;
  concurrency?: number;
  timeoutMs?: number;
  broadFailureThreshold: BroadFailureThreshold;
  lockLeaseSeconds: number;
  environment?: Readonly<Record<string, string | undefined>>;
  databaseUrl?: string;
  database?: BollingerShadowDatabase;
  fetchBatch?: typeof fetchDailyCandleDatasets;
  acquireLock?: (operation: "OBSERVATION" | "RESULTS", ownerId: string, leaseSeconds: number,
    database: BollingerShadowDatabase, secretHex?: string) => Promise<boolean>;
  releaseLock?: (operation: "OBSERVATION" | "RESULTS", ownerId: string,
    database: BollingerShadowDatabase, secretHex?: string) => Promise<void>;
};
export type BollingerShadowObservationOptions = BollingerShadowCommonOptions & {
  stocks?: readonly BollingerRunnerStock[];
  runObservation?: typeof runBollingerObservationBatch;
};
export type BollingerShadowResultsOptions = BollingerShadowCommonOptions & {
  runResults?: typeof runBollingerResultBatch;
  selectEvents?: (limit: number, database: BollingerShadowDatabase) => Promise<PendingBollingerEvent[]>;
};

export class BollingerShadowAutomationError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = "BollingerShadowAutomationError"; this.code = code; }
}

export type BollingerShadowAuditSummary = {
  operation: "OBSERVATION" | "RESULTS"; targetJstDate: string; devConfirmed: true;
  shadowOnly: true; killSwitch: "ON"; requested: number; processed: number; created: number;
  existing: number; skipped: number; failed: number; fetchFailures: number; http429: number;
  timeout: number; canonicalMismatch: number; freshnessMismatch: number; duplicate: number;
  orphan: number; executionSource: typeof BOLLINGER_SHADOW_EXECUTION_SOURCE;
  status: "COMPLETED" | "FAILED" | "LOCKED"; reason?: string;
  freshnessDiagnostics?: FreshnessDiagnostic[]; freshnessDiagnosticsTruncated?: boolean;
};

export type FreshnessDiagnostic = {
  symbol: string; expectedDate: string; latestDate: string | null;
  freshnessMatched: boolean; failureKind: string | null;
};

function validateConfiguration(options: BollingerShadowCommonOptions) {
  const environment = options.environment ?? process.env;
  if (environment.TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED !== "true") {
    throw new BollingerShadowAutomationError("KILL_SWITCH_OFF");
  }
  if (options.mode !== "PREVIEW" && options.mode !== "SAVE") throw new BollingerShadowAutomationError("INVALID_MODE");
  const url = options.databaseUrl ?? environment.DATABASE_URL;
  if (!url) throw new BollingerShadowAutomationError("DEV_DATABASE_UNCONFIRMED");
  try {
    if (url !== PHASE7_OFFLINE_DESTINATION) validatePhase7DedicatedDestination(url);
    else if (!options.environment || !options.databaseUrl) throw new Phase7SecurityError("OFFLINE_DEPENDENCIES_REQUIRED");
    assertPhase7Database(options.database, url);
  }
  catch (error) { throw new BollingerShadowAutomationError(error instanceof Phase7SecurityError ? error.code : "DEV_DATABASE_UNCONFIRMED"); }
  if (normalizeDateOnly(options.targetTradeDate) !== options.targetTradeDate) {
    throw new BollingerShadowAutomationError("INVALID_TARGET_TRADE_DATE");
  }
  const threshold = options.broadFailureThreshold;
  if (!threshold || !Number.isInteger(threshold.minimumAffectedSymbols) || threshold.minimumAffectedSymbols < 1
    || !Number.isFinite(threshold.affectedRatio) || threshold.affectedRatio <= 0 || threshold.affectedRatio > 1) {
    throw new BollingerShadowAutomationError("INVALID_BROAD_FAILURE_THRESHOLD");
  }
  if (!Number.isInteger(options.lockLeaseSeconds) || options.lockLeaseSeconds < 1) {
    throw new BollingerShadowAutomationError("INVALID_LOCK_LEASE_SECONDS");
  }
}

function lockKey(operation: "OBSERVATION" | "RESULTS") {
  return operation === "OBSERVATION" ? OBSERVATION_LOCK_KEY : RESULTS_LOCK_KEY;
}
async function acquireDefault(operation: "OBSERVATION" | "RESULTS", ownerId: string,
  leaseSeconds: number, database: BollingerShadowDatabase, secretHex?: string) {
  if (secretHex) {
    const result = await database.query(PHASE7_CAP_ACQUIRE_SQL, [lockKey(operation), ownerId, secretHex, leaseSeconds]);
    return result.rows.length === 1 && result.rows[0]?.acquired === true;
  }
  // Kept for existing isolated OFFLINE simulations; real adapter rejects legacy lock SQL.
  const result = await database.query(PHASE7_ACQUIRE_LOCK_SQL, [lockKey(operation), ownerId, leaseSeconds]);
  return Boolean(result.rows[0]);
}
async function releaseDefault(operation: "OBSERVATION" | "RESULTS", ownerId: string,
  database: BollingerShadowDatabase, secretHex?: string) {
  if (secretHex) {
    const result = await database.query(PHASE7_CAP_RELEASE_SQL, [lockKey(operation), ownerId, secretHex]);
    if (result.rows.length !== 1 || result.rows[0]?.released !== true) throw new BollingerShadowAutomationError("CAPABILITY_RELEASE_FAILED");
    return;
  }
  await database.query(PHASE7_RELEASE_LOCK_SQL, [lockKey(operation), ownerId]);
}

function tradeDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric",
    month: "2-digit", day: "2-digit" }).format(new Date(timestamp * 1_000));
}

function observationFreshness(dataset: CandleDataset, target: string, now: Date) {
  if (dataset.timeframe !== "1D") return { matched: false, latestDate: null, failureKind: "TIMEFRAME_MISMATCH" };
  if (dataset.status !== "COMPLETE") return { matched: false, latestDate: null, failureKind: "DATASET_NOT_COMPLETE" };
  const timeline = completedCandlesAsOf(dataset.candles, "1D", now.getTime() / 1_000);
  if (timeline.rejectedCount > 0) return { matched: false, latestDate: null, failureKind: "INVALID_CANDLE" };
  if (timeline.duplicateCount > 0) return { matched: false, latestDate: null, failureKind: "DUPLICATE_CANDLE" };
  if (!timeline.candles.length) return { matched: false, latestDate: null, failureKind: "NO_COMPLETED_CANDLE" };
  const latest = timeline.candles.at(-1)!;
  const completedAt = candleCompletedAt(latest, "1D");
  const latestDate = tradeDate(latest.time);
  if (completedAt === null || completedAt > now.getTime() / 1_000) {
    return { matched: false, latestDate, failureKind: "CANDLE_NOT_COMPLETED" };
  }
  const matched = latestDate === target;
  return { matched, latestDate, failureKind: matched ? null : "TARGET_DATE_MISMATCH" };
}

function classifyFailure(reason: unknown) {
  if (reason instanceof DailyDataFetchError) return reason.kind;
  const value = reason as { kind?: string; name?: string; status?: number } | undefined;
  if (value?.kind === "HTTP_429" || value?.status === 429) return "HTTP_429";
  if (value?.kind === "TIMEOUT" || value?.name === "AbortError" || value?.name === "TimeoutError") return "TIMEOUT";
  return "HTTP_FAILURE";
}

function gateBatch(batch: Batch, target: string, now: Date, requireTargetFreshness: boolean,
  symbols: readonly string[] = []) {
  let fetchFailures = 0; let http429 = 0; let timeout = 0; let freshnessMismatch = 0;
  const diagnostics: FreshnessDiagnostic[] = []; let freshnessDiagnosticsTruncated = false;
  const settled = batch.settled.map((item, index) => {
    if (item.status === "rejected") {
      fetchFailures += 1; const kind = classifyFailure(item.reason);
      if (kind === "HTTP_429") http429 += 1; if (kind === "TIMEOUT") timeout += 1;
      if (requireTargetFreshness) {
        if (diagnostics.length < 20) diagnostics.push({ symbol: symbols[index] ?? "UNKNOWN",
          expectedDate: target, latestDate: null, freshnessMatched: false, failureKind: kind });
        else freshnessDiagnosticsTruncated = true;
      }
      return item;
    }
    const dataset = item.value.dataset;
    const timeline = completedCandlesAsOf(dataset.candles, "1D", now.getTime() / 1_000);
    const canonical = dataset.timeframe === "1D" && dataset.status === "COMPLETE"
      && timeline.rejectedCount === 0 && timeline.duplicateCount === 0;
    const freshness = observationFreshness(dataset, target, now);
    const fresh = canonical && (!requireTargetFreshness || freshness.matched);
    if (requireTargetFreshness) {
      if (diagnostics.length < 20) diagnostics.push({ symbol: item.value.code, expectedDate: target,
        latestDate: freshness.latestDate, freshnessMatched: fresh,
        failureKind: fresh ? null : freshness.failureKind ?? "CANONICAL_DATASET_MISMATCH" });
      else freshnessDiagnosticsTruncated = true;
    }
    if (!fresh) {
      freshnessMismatch += 1;
      return { status: "rejected", reason: { kind: "FRESHNESS_MISMATCH" } } as const;
    }
    return item;
  });
  return { batch: { ...batch, settled } as Batch, fetchFailures, http429, timeout, freshnessMismatch,
    freshnessDiagnostics: diagnostics, freshnessDiagnosticsTruncated };
}

function isBroadFailure(total: number, affected: number, threshold: BroadFailureThreshold) {
  return total > 0 && affected >= threshold.minimumAffectedSymbols && affected / total >= threshold.affectedRatio;
}

async function integrity(database: BollingerShadowDatabase) {
  const duplicate = await database.query(PHASE7_DUPLICATE_SQL);
  const orphan = await database.query(PHASE7_ORPHAN_SQL);
  return { duplicate: Number(duplicate.rows[0]?.count ?? 0), orphan: Number(orphan.rows[0]?.count ?? 0) };
}

function baseSummary(operation: "OBSERVATION" | "RESULTS", options: BollingerShadowCommonOptions): BollingerShadowAuditSummary {
  return { operation, targetJstDate: options.targetTradeDate, devConfirmed: true, shadowOnly: true,
    killSwitch: "ON", requested: 0, processed: 0, created: 0, existing: 0, skipped: 0,
    failed: 0, fetchFailures: 0, http429: 0, timeout: 0, canonicalMismatch: 0,
    freshnessMismatch: 0, duplicate: 0, orphan: 0, executionSource: BOLLINGER_SHADOW_EXECUTION_SOURCE,
    status: "COMPLETED" };
}

export async function runBollingerShadowObservation(options: BollingerShadowObservationOptions) {
  validateConfiguration(options); const database = options.database!;
  const ownerId = randomUUID();
  const secretHex = (options.databaseUrl ?? options.environment?.DATABASE_URL) === PHASE7_OFFLINE_DESTINATION
    ? undefined : randomBytes(32).toString("hex");
  const acquire = options.acquireLock ?? acquireDefault;
  const release = options.releaseLock ?? releaseDefault; const summary = baseSummary("OBSERVATION", options);
  if (!await acquire("OBSERVATION", ownerId, options.lockLeaseSeconds, database, secretHex)) {
    return { ...summary, status: "LOCKED" as const, reason: "LOCK_NOT_ACQUIRED" };
  }
  try {
    const stocks = (options.stocks ?? ACTIVE_STOCKS).slice(0, options.limit);
    if (options.databaseUrl === PHASE7_OFFLINE_DESTINATION && !options.fetchBatch)
      throw new Phase7SecurityError("OFFLINE_DEPENDENCIES_REQUIRED");
    const fetcher = options.fetchBatch ?? fetchDailyCandleDatasets;
    const raw = await fetcher(stocks.map((stock) => stock.code), "LONG_300", DAILY_DATASET_REQUIREMENTS.RECENT_RANGE_20,
      { concurrency: options.concurrency, timeoutMs: options.timeoutMs, nowMs: (options.now ?? new Date()).getTime() });
    const gated = gateBatch(raw, options.targetTradeDate, options.now ?? new Date(), true,
      stocks.map((stock) => stock.code));
    const affected = gated.fetchFailures + gated.freshnessMismatch;
    if (isBroadFailure(raw.unique, affected, options.broadFailureThreshold)) {
      const check = await integrity(database);
      return { ...summary, requested: raw.requested, failed: affected,
        fetchFailures: gated.fetchFailures, http429: gated.http429, timeout: gated.timeout,
        freshnessMismatch: gated.freshnessMismatch, freshnessDiagnostics: gated.freshnessDiagnostics,
        freshnessDiagnosticsTruncated: gated.freshnessDiagnosticsTruncated,
        ...check, status: "FAILED" as const, reason: "BROAD_PROVIDER_FAILURE" };
    }
    let result;
    try {
      result = await (options.runObservation ?? runBollingerObservationBatch)(stocks, {
        mode: options.mode, timeframe: "1D", limit: options.limit, concurrency: options.concurrency,
        timeoutMs: options.timeoutMs, now: options.now, database,
        metadata: { shadowOnly: true, executionSource: BOLLINGER_SHADOW_EXECUTION_SOURCE, phase: "7" },
        stopOnCanonicalMismatch: true,
        // Only the Phase 7 SAVE path requires the transactional lease fence.
        persist: options.mode === "SAVE"
          ? (candidate) => saveBollingerObservation(candidate, database,
              { lockKey: OBSERVATION_LOCK_KEY, ownerId, ...(secretHex ? { secretHex } : {}) })
          : undefined,
        fetchBatch: async () => gated.batch,
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("CANONICAL_SNAPSHOT_MISMATCH")) throw error;
      const check = await integrity(database);
      return { ...summary, requested: stocks.length, canonicalMismatch: 1, failed: 1, ...check,
        status: "FAILED" as const, reason: "CANONICAL_MISMATCH" };
    }
    const canonicalMismatch = result.outcomes.filter((o) => o.reason?.startsWith("CANONICAL_SNAPSHOT_MISMATCH")).length;
    const check = await integrity(database);
    return { ...summary, requested: result.requestedSymbols, processed: result.processedSymbols,
      created: result.snapshotsCreated + result.eventsCreated, existing: result.snapshotsExisting,
      skipped: result.noEventCount + result.invalidDatasets, failed: result.failedSymbols,
      fetchFailures: gated.fetchFailures, http429: gated.http429, timeout: gated.timeout,
      freshnessMismatch: gated.freshnessMismatch, canonicalMismatch,
      freshnessDiagnostics: gated.freshnessDiagnostics,
      freshnessDiagnosticsTruncated: gated.freshnessDiagnosticsTruncated, ...check,
      status: canonicalMismatch || result.failedSymbols > 0 ? "FAILED" as const : "COMPLETED" as const,
      ...(canonicalMismatch ? { reason: "CANONICAL_MISMATCH" } : {}), runner: result };
  } finally { await release("OBSERVATION", ownerId, database, secretHex); }
}

function validateResultInputs(inputs: readonly BollingerResultPersistenceInput[], event: PendingBollingerEvent) {
  for (const input of inputs) {
    if (event.phase7Provenance !== true || input.eventId !== event.eventId || input.entryPrice !== event.close || input.windowCandleCount !== input.horizon
      || input.resultQuality !== "COMPLETE" || input.resultVersion !== "BB_OBSERVATION_RESULT_V1"
      || input.horizonUnit !== "TRADING_DAY" || event.timeframe !== "1D") {
      throw new BollingerShadowAutomationError("RESULT_GATE_FAILED");
    }
  }
}

export async function runBollingerShadowResults(options: BollingerShadowResultsOptions) {
  validateConfiguration(options); const database = options.database!;
  const ownerId = randomUUID();
  const secretHex = (options.databaseUrl ?? options.environment?.DATABASE_URL) === PHASE7_OFFLINE_DESTINATION
    ? undefined : randomBytes(32).toString("hex");
  const acquire = options.acquireLock ?? acquireDefault;
  const release = options.releaseLock ?? releaseDefault; const summary = baseSummary("RESULTS", options);
  if (!await acquire("RESULTS", ownerId, options.lockLeaseSeconds, database, secretHex)) {
    return { ...summary, status: "LOCKED" as const, reason: "LOCK_NOT_ACQUIRED" };
  }
  try {
    if (options.databaseUrl === PHASE7_OFFLINE_DESTINATION && !options.fetchBatch)
      throw new Phase7SecurityError("OFFLINE_DEPENDENCIES_REQUIRED");
    const events = await (options.selectEvents
      ? options.selectEvents(options.limit, database) : selectPendingBollingerEvents(database, options.limit, true));
    if (events.some(event => event.phase7Provenance !== true || !PHASE7_RESULT_CODES.includes(event.code))) throw new BollingerShadowAutomationError("INVALID_PROVENANCE");
    const codes = Array.from(new Set(events.map((event) => event.code)));
    const fetcher = options.fetchBatch ?? fetchDailyCandleDatasets; const now = options.now ?? new Date();
    const raw = await fetcher(codes, "LONG_300", DAILY_DATASET_REQUIREMENTS.RECENT_RANGE_20,
      { concurrency: options.concurrency, timeoutMs: options.timeoutMs, nowMs: now.getTime() });
    const gated = gateBatch(raw, options.targetTradeDate, now, false);
    const datasetByCode = new Map(gated.batch.settled.flatMap((item) => item.status === "fulfilled"
      ? [[item.value.code, item.value.dataset] as const] : []));
    const resultFreshnessCodes = new Set<string>();
    for (const event of events) {
      const dataset = datasetByCode.get(event.code); const future = dataset ? futureCandlesFromDataset(dataset, event, now) : null;
      if (!future) { resultFreshnessCodes.add(event.code); continue; }
      const calendarDiagnostics = inspectBollingerResultCalendar(event.observationDate, future, now);
      if (calendarDiagnostics.horizons.some((item) => item.failureKind === "TARGET_CANDLE_MISSING")) {
        resultFreshnessCodes.add(event.code);
      }
      const evaluation = evaluateBollingerObservationFuture({ timeframe: "1D", close: event.close,
        observationDate: event.observationDate, barEndAt: event.barEndAt }, future);
      if (evaluation.completed.some((item) => item.windowCandleCount !== item.horizon)) resultFreshnessCodes.add(event.code);
    }
    const resultFreshnessMismatch = gated.freshnessMismatch + resultFreshnessCodes.size;
    const affected = gated.fetchFailures + resultFreshnessMismatch;
    if (isBroadFailure(raw.unique, affected, options.broadFailureThreshold)) {
      const check = await integrity(database);
      return { ...summary, requested: events.length, failed: affected, fetchFailures: gated.fetchFailures,
        http429: gated.http429, timeout: gated.timeout, freshnessMismatch: resultFreshnessMismatch,
        ...check, status: "FAILED" as const, reason: "BROAD_PROVIDER_FAILURE" };
    }
    const eventById = new Map(events.map((event) => [event.eventId, event]));
    const { saveBollingerObservationResults } = await import("./bollingerObservationResultPersistence.ts");
    let result;
    try {
      result = await (options.runResults ?? runBollingerResultBatch)({ mode: options.mode, limit: options.limit,
        concurrency: options.concurrency, timeoutMs: options.timeoutMs, now, database,
        stopOnCanonicalMismatch: true,
        selectEvents: async () => events, fetchBatch: async () => gated.batch,
        persist: async (inputs, persistenceOptions) => {
          const event = eventById.get(inputs[0]?.eventId);
          if (!event) throw new BollingerShadowAutomationError("RESULT_EVENT_NOT_SELECTED");
          validateResultInputs(inputs, event);
          return saveBollingerObservationResults(inputs, { ...persistenceOptions, database,
            lease: options.mode === "SAVE" ? { lockKey: RESULTS_LOCK_KEY, ownerId, ...(secretHex ? { secretHex } : {}) } : undefined,
            validateParent: async (client, eventId) => {
              const parent = await client.query(PHASE7_PARENT_SQL, [eventId]);
              if (parent.rows.length !== 1) throw new BollingerShadowAutomationError("INVALID_PROVENANCE");
              const row = parent.rows[0];
              const timestamp = (value: unknown) => typeof value === "string" || value instanceof Date
                ? new Date(value).getTime() : NaN;
              if (!canonicalNumericEqual(row.event_id, event.eventId)
                || !Number.isSafeInteger(event.snapshotId) || !canonicalNumericEqual(row.snapshot_id, event.snapshotId)
                || row.code !== event.code || row.timeframe !== event.timeframe
                || !canonicalNumericEqual(row.close, event.close)
                || normalizeDateOnly(row.observation_date) !== event.observationDate
                || !Number.isFinite(timestamp(event.barEndAt)) || timestamp(row.bar_end_at) !== timestamp(event.barEndAt)
                || row.side !== event.side || !canonicalNumericEqual(row.sigma_level, event.sigmaLevel)
                || row.event_type !== event.eventType) throw new BollingerShadowAutomationError("INVALID_PROVENANCE");
            },
          });
        } });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("CANONICAL_RESULT_MISMATCH")) throw error;
      const check = await integrity(database);
      return { ...summary, requested: events.length, canonicalMismatch: 1, failed: 1, ...check,
        status: "FAILED" as const, reason: "CANONICAL_MISMATCH" };
    }
    const canonicalMismatch = result.outcomes.filter((o) => o.reason?.startsWith("CANONICAL_RESULT_MISMATCH")).length;
    const check = await integrity(database);
    return { ...summary, requested: result.requestedEvents, processed: result.processedEvents,
      created: result.resultsCreated, existing: result.resultsExisting, skipped: result.unavailableEvents,
      failed: result.failedEvents, fetchFailures: gated.fetchFailures, http429: gated.http429,
      timeout: gated.timeout, freshnessMismatch: resultFreshnessMismatch, canonicalMismatch, ...check,
      resultCalendarDiagnostics: result.resultCalendarDiagnostics,
      resultCalendarDiagnosticsTruncated: result.resultCalendarDiagnosticsTruncated,
      status: canonicalMismatch || result.failedEvents > 0 ? "FAILED" as const : "COMPLETED" as const,
      ...(canonicalMismatch ? { reason: "CANONICAL_MISMATCH" } : {}), runner: result };
  } finally { await release("RESULTS", ownerId, database, secretHex); }
}
