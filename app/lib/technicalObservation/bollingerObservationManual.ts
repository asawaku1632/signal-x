import { ACTIVE_STOCKS } from "../activeStockList.ts";
import { runBollingerObservationBatch } from "./bollingerObservationRunner.ts";
import { runBollingerResultBatch } from "./bollingerObservationResultRunner.ts";

export type BollingerManualOperation = "OBSERVATION" | "RESULTS";
export type BollingerManualMode = "PREVIEW" | "SAVE";

export type BollingerManualRequest = {
  operation: BollingerManualOperation;
  mode: BollingerManualMode;
  limit: number;
  codes?: string[];
};

export type BollingerManualAuditSummary = {
  operation: BollingerManualOperation;
  mode: BollingerManualMode;
  startedAt: string;
  finishedAt: string;
  requested: number;
  processed: number;
  success: number;
  noEvent: number;
  invalidData: number;
  fetchFailed: number;
  persistenceFailed: number;
  candidateSnapshots: number;
  candidateEvents: number;
  snapshotsCreated: number;
  snapshotsExisting: number;
  eventsCreated: number;
  resultCreated: number;
  resultExisting: number;
  noResultAvailable: number;
  canonicalMismatchCount: number;
  failures: Array<{ code?: string; eventId?: number; reason: string }>;
};

type ObservationRun = Awaited<ReturnType<typeof runBollingerObservationBatch>>;
type ResultRun = Awaited<ReturnType<typeof runBollingerResultBatch>>;

export type BollingerManualDependencies = {
  runObservation?: typeof runBollingerObservationBatch;
  runResults?: typeof runBollingerResultBatch;
  now?: () => Date;
  audit?: (summary: BollingerManualAuditSummary) => void;
};

const DEFAULT_LIMIT = 20;
export const BOLLINGER_MANUAL_MAX_LIMIT = 50;
const activeByCode = new Map(ACTIVE_STOCKS.map((stock) => [String(stock.code), stock]));

function invalid(reason: string): never {
  throw new Error(`INVALID_MANUAL_REQUEST:${reason}`);
}

export function parseBollingerManualRequest(input: unknown): BollingerManualRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("BODY");
  const body = input as Record<string, unknown>;
  if (body.operation !== "OBSERVATION" && body.operation !== "RESULTS") invalid("OPERATION");
  const mode = body.mode === undefined ? "PREVIEW" : body.mode;
  if (mode !== "PREVIEW" && mode !== "SAVE") invalid("MODE");
  if (mode === "SAVE" && body.limit === undefined) invalid("SAVE_LIMIT_REQUIRED");
  const limit = body.limit === undefined ? DEFAULT_LIMIT : body.limit;
  if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > BOLLINGER_MANUAL_MAX_LIMIT) {
    invalid("LIMIT");
  }
  if (body.timeframe !== undefined && body.timeframe !== "1D") invalid("TIMEFRAME");
  if (body.codes !== undefined && body.operation !== "OBSERVATION") invalid("RESULT_CODES_UNSUPPORTED");
  let codes: string[] | undefined;
  if (body.codes !== undefined) {
    if (!Array.isArray(body.codes) || body.codes.length === 0 || body.codes.length > Number(limit)) invalid("CODES");
    codes = Array.from(new Set(body.codes.map((value) => {
      if (typeof value !== "string" || value.trim() === "") invalid("CODE");
      const code = value.trim();
      if (!activeByCode.has(code)) invalid("CODE_NOT_ACTIVE");
      return code;
    })));
  }
  return { operation: body.operation, mode, limit: Number(limit), ...(codes ? { codes } : {}) };
}

function countStatuses(outcomes: ReadonlyArray<{ status: string }>, status: string) {
  return outcomes.filter((outcome) => outcome.status === status).length;
}

function safeFailures(outcomes: ReadonlyArray<{ code?: string; eventId?: number; status: string; reason?: string }>) {
  return outcomes.filter((outcome) => outcome.status.endsWith("FAILED") || outcome.status === "UNSUPPORTED")
    .map((outcome) => ({ ...(outcome.code ? { code: outcome.code } : {}),
      ...(outcome.eventId !== undefined ? { eventId: outcome.eventId } : {}),
      reason: outcome.reason?.startsWith("CANONICAL_") ? outcome.reason : outcome.status }));
}

function observationAudit(request: BollingerManualRequest, result: ObservationRun,
  startedAt: string, finishedAt: string): BollingerManualAuditSummary {
  const outcomes = result.outcomes;
  return { operation: request.operation, mode: request.mode, startedAt, finishedAt,
    requested: result.requestedSymbols, processed: result.processedSymbols,
    success: countStatuses(outcomes, "SUCCESS"), noEvent: result.noEventCount,
    invalidData: result.invalidDatasets, fetchFailed: countStatuses(outcomes, "FETCH_FAILED"),
    persistenceFailed: countStatuses(outcomes, "PERSISTENCE_FAILED"),
    candidateSnapshots: result.candidateSnapshots, candidateEvents: result.candidateEvents,
    snapshotsCreated: result.snapshotsCreated, snapshotsExisting: result.snapshotsExisting,
    eventsCreated: result.eventsCreated, resultCreated: 0, resultExisting: 0,
    noResultAvailable: 0, canonicalMismatchCount: outcomes.filter((item) =>
      item.reason?.startsWith("CANONICAL_SNAPSHOT_MISMATCH")).length,
    failures: safeFailures(outcomes) };
}

function resultAudit(request: BollingerManualRequest, result: ResultRun,
  startedAt: string, finishedAt: string): BollingerManualAuditSummary {
  const outcomes = result.outcomes;
  return { operation: request.operation, mode: request.mode, startedAt, finishedAt,
    requested: result.requestedEvents, processed: result.processedEvents,
    success: countStatuses(outcomes, "SUCCESS"), noEvent: 0, invalidData: 0,
    fetchFailed: countStatuses(outcomes, "FETCH_FAILED"), persistenceFailed: 0,
    candidateSnapshots: 0, candidateEvents: 0, snapshotsCreated: 0, snapshotsExisting: 0,
    eventsCreated: 0, resultCreated: result.resultsCreated, resultExisting: result.resultsExisting,
    noResultAvailable: result.unavailableEvents,
    canonicalMismatchCount: outcomes.filter((item) =>
      item.reason?.startsWith("CANONICAL_RESULT_MISMATCH")).length,
    failures: safeFailures(outcomes) };
}

export async function executeBollingerManualOperation(input: unknown,
  dependencies: BollingerManualDependencies = {}) {
  const request = parseBollingerManualRequest(input);
  const clock = dependencies.now ?? (() => new Date());
  const startedAt = clock().toISOString();
  let runner: ObservationRun | ResultRun;
  let audit: BollingerManualAuditSummary;
  if (request.operation === "OBSERVATION") {
    const stocks = request.codes
      ? request.codes.map((code) => activeByCode.get(code)!)
      : ACTIVE_STOCKS.slice(0, request.limit);
    runner = await (dependencies.runObservation ?? runBollingerObservationBatch)(stocks, {
      mode: request.mode, timeframe: "1D", limit: request.limit,
      metadata: { shadowOnly: true, manualExecution: true,
        executionSource: "PHASE_6_1_MANUAL", phase: "6.1" },
    });
    audit = observationAudit(request, runner, startedAt, clock().toISOString());
  } else {
    runner = await (dependencies.runResults ?? runBollingerResultBatch)({
      mode: request.mode, limit: request.limit,
    });
    audit = resultAudit(request, runner, startedAt, clock().toISOString());
  }
  (dependencies.audit ?? ((summary) => console.info("BB_OBSERVATION_MANUAL_AUDIT", JSON.stringify(summary))))(audit);
  return { request, audit, runner };
}
