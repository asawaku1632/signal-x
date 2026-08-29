import { fetchDailyCandleDatasets } from "./dailyData.ts";
import { createCandleDataset, DAILY_DATASET_REQUIREMENTS } from "./datasets.ts";
import { completedCandlesAsOf, candleCompletedAt } from "./timeframeFoundation.ts";
import { calculateBollingerObservation } from "./bollingerObservationMath.ts";
import { detectBollingerObservationEvents } from "./bollingerObservationDetector.ts";
import { createBollingerObservationEvidence } from "./bollingerObservationEvidence.ts";
import { saveBollingerObservation, type BollingerObservationDatabase,
  type BollingerObservationPersistenceInput } from "./bollingerObservationPersistence.ts";
import { BOLLINGER_OBSERVATION_DETECTOR_VERSION } from "./bollingerObservationTypes.ts";
import type { CandleDataset } from "./types.ts";

export type BollingerRunnerMode = "PREVIEW" | "SAVE";
export type BollingerRunnerStock = { code: string; name: string };
type BatchResult = Awaited<ReturnType<typeof fetchDailyCandleDatasets>>;

export type BollingerObservationRunnerOptions = {
  mode?: BollingerRunnerMode;
  timeframe?: "1D" | "1W";
  limit: number;
  concurrency?: number;
  timeoutMs?: number;
  now?: Date;
  database?: BollingerObservationDatabase;
  metadata?: Readonly<Record<string, unknown>>;
  stopOnCanonicalMismatch?: boolean;
  fetchBatch?: (codes: readonly string[], options: { concurrency?: number; timeoutMs?: number;
    nowMs: number }) => Promise<BatchResult>;
  persist?: typeof saveBollingerObservation;
};

function validateOptions(options: BollingerObservationRunnerOptions) {
  if (options.timeframe !== undefined && options.timeframe !== "1D") throw new Error("UNSUPPORTED_RUNNER_TIMEFRAME");
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) throw new Error("INVALID_RUNNER_LIMIT");
  if (options.mode !== undefined && !(["PREVIEW", "SAVE"] as const).includes(options.mode)) {
    throw new Error("INVALID_RUNNER_MODE");
  }
}

function tokyoTradeDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric",
    month: "2-digit", day: "2-digit" }).format(new Date(timestamp * 1_000));
}

export function buildLatestBollingerObservationCandidate(input: {
  code: string; dataset: CandleDataset; now: Date; metadata?: Readonly<Record<string, unknown>>;
}): BollingerObservationPersistenceInput | null {
  if (input.dataset.timeframe !== "1D" || input.dataset.status !== "COMPLETE") return null;
  const asOf = input.now.getTime() / 1_000;
  const timeline = completedCandlesAsOf(input.dataset.candles, "1D", asOf);
  if (timeline.rejectedCount > 0 || timeline.duplicateCount > 0) return null;
  const completed = createCandleDataset({ timeframe: "1D", source: input.dataset.source,
    range: input.dataset.range, interval: input.dataset.interval, candles: timeline.candles,
    requirement: DAILY_DATASET_REQUIREMENTS.RECENT_RANGE_20, nowMs: input.now.getTime() });
  if (completed.status !== "COMPLETE" || completed.candles.length < 21) return null;
  const current = completed.candles.at(-1)!; const previous = completed.candles.at(-2)!;
  const currentCalculation = calculateBollingerObservation(completed.candles.map((item) => item.close), "1D");
  const previousCalculation = calculateBollingerObservation(
    completed.candles.slice(0, -1).map((item) => item.close), "1D");
  if (currentCalculation.reason !== null || previousCalculation.reason !== null) return null;
  const currentBands = { lower2: currentCalculation.bbLower2!, lower3: currentCalculation.bbLower3!,
    upper2: currentCalculation.bbUpper2!, upper3: currentCalculation.bbUpper3! };
  const previousBands = { lower2: previousCalculation.bbLower2!, lower3: previousCalculation.bbLower3!,
    upper2: previousCalculation.bbUpper2!, upper3: previousCalculation.bbUpper3! };
  const events = detectBollingerObservationEvents({ current, currentBands, previous, previousBands });
  if (!events.length) return null;
  const completedAt = candleCompletedAt(current, "1D");
  if (completedAt === null || completedAt > asOf) return null;
  const evidence = createBollingerObservationEvidence(completed.candles, "1D");
  return {
    code: input.code, observationDate: tokyoTradeDate(current.time), timeframe: "1D", close: current.close,
    calculation: currentCalculation, evidence, events,
    detectorVersion: BOLLINGER_OBSERVATION_DETECTOR_VERSION, provider: completed.source,
    providerTimestamp: new Date(current.time * 1_000), barStartAt: new Date(current.time * 1_000),
    barEndAt: new Date(completedAt * 1_000), timezone: "Asia/Tokyo",
    metadata: { shadowOnly: true, phase: "6", ...(input.metadata ?? {}) },
  };
}

export async function runBollingerObservationBatch(
  stocks: readonly BollingerRunnerStock[],
  options: BollingerObservationRunnerOptions,
) {
  validateOptions(options);
  const mode = options.mode ?? "PREVIEW"; const now = options.now ?? new Date();
  const targets = stocks.slice(0, options.limit);
  const unique = Array.from(new Map(targets.map((stock) => [String(stock.code), stock])).values());
  const batch = options.fetchBatch
    ? await options.fetchBatch(unique.map((stock) => stock.code), { concurrency: options.concurrency,
      timeoutMs: options.timeoutMs, nowMs: now.getTime() })
    : await fetchDailyCandleDatasets(unique.map((stock) => stock.code), "LONG_300",
      DAILY_DATASET_REQUIREMENTS.RECENT_RANGE_20, { concurrency: options.concurrency,
        timeoutMs: options.timeoutMs, nowMs: now.getTime() });
  const outcomes: Array<{ code: string; status: string; eventCount?: number; reason?: string }> = [];
  let validDatasets = 0; let invalidDatasets = 0; let noEventCount = 0;
  let candidateSnapshots = 0; let candidateEvents = 0; let snapshotsCreated = 0;
  let snapshotsExisting = 0; let eventsCreated = 0; let failedSymbols = 0;
  for (let index = 0; index < batch.settled.length; index += 1) {
    const settled = batch.settled[index]; const code = unique[index]?.code ?? "UNKNOWN";
    if (settled.status === "rejected") {
      failedSymbols += 1; outcomes.push({ code, status: "FETCH_FAILED", reason: "DAILY_FETCH_FAILED" }); continue;
    }
    const dataset = settled.value.dataset;
    if (dataset.status !== "COMPLETE") {
      invalidDatasets += 1; outcomes.push({ code, status: "INVALID_DATA", reason: dataset.status }); continue;
    }
    const candidate = buildLatestBollingerObservationCandidate({ code, dataset, now, metadata: options.metadata });
    if (!candidate) {
      const completedTimeline = completedCandlesAsOf(dataset.candles, "1D", now.getTime() / 1_000);
      const completedDataset = createCandleDataset({ timeframe: "1D", source: dataset.source,
        range: dataset.range, interval: dataset.interval, candles: completedTimeline.candles,
        requirement: DAILY_DATASET_REQUIREMENTS.RECENT_RANGE_20, nowMs: now.getTime() });
      const safe = completedTimeline.rejectedCount === 0 && completedTimeline.duplicateCount === 0
        && completedDataset.status === "COMPLETE";
      if (safe) { validDatasets += 1; noEventCount += 1; outcomes.push({ code, status: "NO_EVENT" }); }
      else { invalidDatasets += 1; outcomes.push({ code, status: "INVALID_DATA", reason: "NO_VALID_CONFIRMED_WINDOW" }); }
      continue;
    }
    validDatasets += 1; candidateSnapshots += 1; candidateEvents += candidate.events.length;
    if (mode === "PREVIEW") {
      outcomes.push({ code, status: "SUCCESS", eventCount: candidate.events.length }); continue;
    }
    try {
      const saved = await (options.persist ?? saveBollingerObservation)(candidate, options.database);
      if (saved.snapshotCreated) snapshotsCreated += 1; else snapshotsExisting += 1;
      eventsCreated += saved.eventsCreated;
      outcomes.push({ code, status: "SUCCESS", eventCount: candidate.events.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (options.stopOnCanonicalMismatch && message.startsWith("CANONICAL_SNAPSHOT_MISMATCH")) throw error;
      failedSymbols += 1; outcomes.push({ code, status: "PERSISTENCE_FAILED",
        reason: message.startsWith("CANONICAL_SNAPSHOT_MISMATCH") ? message : "OBSERVATION_SAVE_FAILED" });
    }
  }
  return { mode, requestedSymbols: targets.length, processedSymbols: unique.length,
    validDatasets, invalidDatasets, noEventCount, candidateSnapshots, candidateEvents,
    snapshotsCreated, snapshotsExisting, eventsCreated, failedSymbols, errors: outcomes.filter((item) =>
      item.status.endsWith("FAILED")), outcomes, maxConcurrency: batch.concurrency };
}
