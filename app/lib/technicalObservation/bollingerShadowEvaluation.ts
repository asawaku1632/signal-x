export const PHASE_8_EVALUATION_VERSION = "BB_SHADOW_EVALUATION_V1" as const;
export const PHASE_8_COHORT_DEFINITION_VERSION = "BB_SHADOW_PRIMARY_COHORTS_V1" as const;
export const PHASE_8_MINIMUM_SAMPLE_THRESHOLD = 30 as const;
export const PHASE_8_FULL_DISTRIBUTION_THRESHOLD = 100 as const;

export const PHASE_8_HORIZONS = Object.freeze([1, 3, 5] as const);
const SIDES = ["LOWER", "UPPER"] as const;
const SIGMA_LEVELS = [2, 3] as const;
const EVENT_TYPES = ["TOUCH", "CROSS", "CONTINUATION", "RETURN_INSIDE"] as const;

export type Phase8Horizon = (typeof PHASE_8_HORIZONS)[number];
export type Phase8Side = (typeof SIDES)[number];
export type Phase8SigmaLevel = (typeof SIGMA_LEVELS)[number];
export type Phase8EventType = (typeof EVENT_TYPES)[number];
export type Phase8EvaluationStatus =
  | "COMPLETE"
  | "INSUFFICIENT_SAMPLE"
  | "INCOMPLETE_DATA"
  | "CALENDAR_MISMATCH"
  | "INVALID_DATA"
  | "VERSION_MISMATCH"
  | "READ_ONLY_GUARD_FAILED";

export type Phase8ResultInput = {
  horizon: Phase8Horizon;
  returnPercent: number;
  maxRisePercent: number;
  maxDrawdownPercent: number;
  expectedTradeDate: string;
  evaluatedTradeDate: string;
  resultVersion: string;
  calendarVersion: string;
};

export type Phase8EventInput = {
  eventId: number;
  snapshotId: number;
  code: string;
  observationDate: string;
  side: Phase8Side;
  sigmaLevel: Phase8SigmaLevel;
  eventType: Phase8EventType;
  detectorVersion: string;
  results: readonly Phase8ResultInput[];
};

export type Phase8EvaluationInput = {
  sourceCutoff: string;
  evaluationVersion: string;
  cohortDefinitionVersion: string;
  detectorVersion: string;
  resultVersion: string;
  calendarVersion: string;
  minimumSampleThreshold?: typeof PHASE_8_MINIMUM_SAMPLE_THRESHOLD;
  readOnly: boolean;
  events: readonly Phase8EventInput[];
};

export type Phase8Metrics = {
  meanReturn: number;
  medianReturn: number;
  positiveReturnRatio: number;
  negativeReturnRatio: number;
  zeroReturnRatio: number;
  meanMaxRise: number;
  medianMaxRise: number;
  meanMaxDrawdown: number;
  medianMaxDrawdown: number;
};

export type Phase8FullMetrics = Phase8Metrics & {
  populationStandardDeviation: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
};

export type Phase8HorizonEvaluation = {
  horizon: Phase8Horizon;
  eventCount: number;
  completeCount: number;
  incompleteCount: number;
  status: "COMPLETE" | "INSUFFICIENT_SAMPLE" | "INCOMPLETE_DATA";
  metrics: Phase8Metrics | Phase8FullMetrics | null;
};

export type Phase8CohortKind = "ALL" | "SIDE" | "SIGMA" | "EVENT_TYPE" | "SIDE_X_SIGMA";

export type Phase8CohortEvaluation = {
  key: string;
  kind: Phase8CohortKind;
  side: Phase8Side | null;
  sigmaLevel: Phase8SigmaLevel | null;
  eventType: Phase8EventType | null;
  sampleCount: number;
  completeSampleCount: number;
  incompleteSampleCount: number;
  fullLifecycleCompleteCount: number;
  uniqueSnapshotCount: number;
  uniqueSymbolCount: number;
  uniqueObservationDateCount: number;
  horizons: Phase8HorizonEvaluation[];
};

type Phase8Metadata = {
  shadowOnly: true;
  experimental: true;
  executionSource: "PHASE_8_SHADOW_EVALUATION";
  phase: "8";
  evaluationVersion: string | null;
  cohortDefinitionVersion: string | null;
  detectorVersion: string | null;
  resultVersion: string | null;
  calendarVersion: string | null;
  sourceCutoff: string | null;
  cohortDefinitionHash: string;
  minimumSampleThreshold: number;
  fullDistributionThreshold: typeof PHASE_8_FULL_DISTRIBUTION_THRESHOLD;
  sampleCount: number | null;
  completeSampleCount: number | null;
  incompleteSampleCount: number | null;
  uniqueSnapshotCount: number | null;
  uniqueSymbolCount: number | null;
  uniqueObservationDateCount: number | null;
  // Evaluator capability: no writes and no DB adapter; no DB transaction is asserted.
  readOnly: true;
  productionConsumerInvoked: false;
};

export type Phase8EvaluationOutput = {
  status: Phase8EvaluationStatus;
  metadata: Phase8Metadata;
  cohorts: Phase8CohortEvaluation[];
  errorCode?: string;
};

type CohortDefinition = {
  key: string;
  kind: Phase8CohortKind;
  side: Phase8Side | null;
  sigmaLevel: Phase8SigmaLevel | null;
  eventType: Phase8EventType | null;
};

const COHORT_DEFINITIONS: readonly CohortDefinition[] = [
  { key: "ALL", kind: "ALL", side: null, sigmaLevel: null, eventType: null },
  ...SIDES.map((side) => ({ key: `SIDE:${side}`, kind: "SIDE" as const,
    side, sigmaLevel: null, eventType: null })),
  ...SIGMA_LEVELS.map((sigmaLevel) => ({ key: `SIGMA:${sigmaLevel}`, kind: "SIGMA" as const,
    side: null, sigmaLevel, eventType: null })),
  ...EVENT_TYPES.map((eventType) => ({ key: `EVENT_TYPE:${eventType}`, kind: "EVENT_TYPE" as const,
    side: null, sigmaLevel: null, eventType })),
  ...SIDES.flatMap((side) => SIGMA_LEVELS.map((sigmaLevel) => ({
    key: `SIDE_X_SIGMA:${side}:${sigmaLevel}`, kind: "SIDE_X_SIGMA" as const,
    side, sigmaLevel, eventType: null,
  }))),
];

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null)
    && Reflect.ownKeys(value).every((key) => typeof key === "string"
      && "value" in Object.getOwnPropertyDescriptor(value, key)!);
}

function dataArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) return false;
  }
  return true;
}

function canonicalize(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== "object" || value === null || ancestors.has(value)) {
    throw new TypeError("Unsupported Phase 8 JSON value");
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      // Reject holes, accessors, symbols and extra properties instead of dropping them.
      if (!dataArray(value)) {
        throw new TypeError("Unsupported Phase 8 JSON array");
      }
      const items: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !("value" in descriptor)) throw new TypeError("Unsupported Phase 8 JSON array");
        items.push(canonicalize(descriptor.value, ancestors));
      }
      return `[${items.join(",")}]`;
    }
    if (!plainRecord(value) || Object.keys(value).length !== Reflect.ownKeys(value).length) {
      throw new TypeError("Unsupported Phase 8 JSON object");
    }
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key], ancestors)}`).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalPhase8Json(value: unknown): string {
  return canonicalize(value);
}

// Noncryptographic audit identifier for the fixed ASCII cohort definitions only.
function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export const PHASE_8_COHORT_DEFINITION_HASH = fnv1a32(canonicalize(COHORT_DEFINITIONS));

function validDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

function validSourceCutoff(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && validDateOnly(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function uniqueCount<T>(values: readonly T[]): number {
  return new Set(values).size;
}

class InvalidAggregate extends Error {}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new InvalidAggregate("NON_FINITE_AGGREGATE");
  return value;
}

function mean(values: readonly number[]): number {
  return finite(values.reduce((sum, value) => finite(sum + value), 0) / values.length);
}

function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

function quantile(values: readonly number[], probability: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  // Hyndman-Fan type 7: interpolate at (n - 1) * probability.
  if (fraction === 0) return finite(sorted[lower]);
  const difference = finite(sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]);
  return finite(sorted[lower] + finite(difference * fraction));
}

function metrics(results: readonly Phase8ResultInput[]): Phase8Metrics | Phase8FullMetrics {
  const returns = results.map((result) => result.returnPercent);
  const rises = results.map((result) => result.maxRisePercent);
  const drawdowns = results.map((result) => result.maxDrawdownPercent);
  const returnMean = mean(returns);
  const basic: Phase8Metrics = {
    meanReturn: returnMean,
    medianReturn: median(returns),
    positiveReturnRatio: returns.filter((value) => value > 0).length / returns.length,
    negativeReturnRatio: returns.filter((value) => value < 0).length / returns.length,
    zeroReturnRatio: returns.filter((value) => value === 0).length / returns.length,
    meanMaxRise: mean(rises),
    medianMaxRise: median(rises),
    meanMaxDrawdown: mean(drawdowns),
    medianMaxDrawdown: median(drawdowns),
  };
  if (results.length < PHASE_8_FULL_DISTRIBUTION_THRESHOLD) return basic;
  const squaredSum = returns.reduce((sum, value) =>
    finite(sum + finite(finite(value - returnMean) ** 2)), 0);
  return {
    ...basic,
    populationStandardDeviation: finite(Math.sqrt(finite(squaredSum / returns.length))),
    p10: quantile(returns, 0.10),
    p25: quantile(returns, 0.25),
    p75: quantile(returns, 0.75),
    p90: quantile(returns, 0.90),
  };
}

function matches(event: Phase8EventInput, definition: CohortDefinition): boolean {
  return (definition.side === null || event.side === definition.side)
    && (definition.sigmaLevel === null || event.sigmaLevel === definition.sigmaLevel)
    && (definition.eventType === null || event.eventType === definition.eventType);
}

function resultFor(event: Phase8EventInput, horizon: Phase8Horizon) {
  return event.results.find((result) => result.horizon === horizon);
}

function fullLifecycle(event: Phase8EventInput): boolean {
  return PHASE_8_HORIZONS.every((horizon) => resultFor(event, horizon) !== undefined);
}

function cohortEvaluation(definition: CohortDefinition, events: readonly Phase8EventInput[], threshold: number) {
  const selected = events.filter((event) => matches(event, definition));
  const lifecycleComplete = selected.filter(fullLifecycle).length;
  return {
    ...definition,
    sampleCount: selected.length,
    completeSampleCount: lifecycleComplete,
    incompleteSampleCount: selected.length - lifecycleComplete,
    fullLifecycleCompleteCount: lifecycleComplete,
    uniqueSnapshotCount: uniqueCount(selected.map((event) => event.snapshotId)),
    uniqueSymbolCount: uniqueCount(selected.map((event) => event.code)),
    uniqueObservationDateCount: uniqueCount(selected.map((event) => event.observationDate)),
    horizons: PHASE_8_HORIZONS.map((horizon): Phase8HorizonEvaluation => {
      const completed = selected.flatMap((event) => {
        const result = resultFor(event, horizon);
        return result ? [result] : [];
      });
      const incompleteCount = selected.length - completed.length;
      const status = completed.length < threshold ? "INSUFFICIENT_SAMPLE"
        : incompleteCount > 0 ? "INCOMPLETE_DATA" : "COMPLETE";
      return { horizon, eventCount: selected.length, completeCount: completed.length, incompleteCount,
        status, metrics: completed.length < threshold ? null : metrics(completed) };
    }),
  } satisfies Phase8CohortEvaluation;
}

function baseMetadata(input: Phase8EvaluationInput, threshold: number): Phase8Metadata {
  const lifecycleComplete = input.events.filter(fullLifecycle).length;
  return {
    shadowOnly: true,
    experimental: true,
    executionSource: "PHASE_8_SHADOW_EVALUATION",
    phase: "8",
    evaluationVersion: input.evaluationVersion,
    cohortDefinitionVersion: input.cohortDefinitionVersion,
    detectorVersion: input.detectorVersion,
    resultVersion: input.resultVersion,
    calendarVersion: input.calendarVersion,
    sourceCutoff: input.sourceCutoff,
    cohortDefinitionHash: PHASE_8_COHORT_DEFINITION_HASH,
    minimumSampleThreshold: threshold,
    fullDistributionThreshold: PHASE_8_FULL_DISTRIBUTION_THRESHOLD,
    sampleCount: input.events.length,
    completeSampleCount: lifecycleComplete,
    incompleteSampleCount: input.events.length - lifecycleComplete,
    uniqueSnapshotCount: uniqueCount(input.events.map((event) => event.snapshotId)),
    uniqueSymbolCount: uniqueCount(input.events.map((event) => event.code)),
    uniqueObservationDateCount: uniqueCount(input.events.map((event) => event.observationDate)),
    readOnly: true,
    productionConsumerInvoked: false,
  };
}

type FailureStatus = Extract<Phase8EvaluationStatus, "CALENDAR_MISMATCH" | "INVALID_DATA" |
  "VERSION_MISMATCH" | "READ_ONLY_GUARD_FAILED">;

function failed(status: FailureStatus, errorCode: string): Phase8EvaluationOutput {
  // Unvalidated metadata is null, never fabricated or derived by traversing rejected input.
  return { status, errorCode, cohorts: [], metadata: {
    shadowOnly: true, experimental: true, executionSource: "PHASE_8_SHADOW_EVALUATION", phase: "8",
    evaluationVersion: null, cohortDefinitionVersion: null, detectorVersion: null,
    resultVersion: null, calendarVersion: null, sourceCutoff: null,
    cohortDefinitionHash: PHASE_8_COHORT_DEFINITION_HASH,
    minimumSampleThreshold: PHASE_8_MINIMUM_SAMPLE_THRESHOLD,
    fullDistributionThreshold: PHASE_8_FULL_DISTRIBUTION_THRESHOLD,
    sampleCount: null, completeSampleCount: null, incompleteSampleCount: null,
    uniqueSnapshotCount: null, uniqueSymbolCount: null, uniqueObservationDateCount: null,
    readOnly: true, productionConsumerInvoked: false,
  } };
}

function versionString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function inputShape(value: unknown): value is Phase8EvaluationInput {
  if (!plainRecord(value) || !dataArray(value.events)
    || typeof value.sourceCutoff !== "string" || typeof value.readOnly !== "boolean"
    || ![value.evaluationVersion, value.cohortDefinitionVersion, value.detectorVersion,
      value.resultVersion, value.calendarVersion].every(versionString)) return false;
  for (const event of value.events) {
    if (!plainRecord(event) || !dataArray(event.results)
      || typeof event.eventId !== "number" || typeof event.snapshotId !== "number"
      || typeof event.code !== "string" || typeof event.observationDate !== "string"
      || !versionString(event.detectorVersion)) return false;
    for (const result of event.results) {
      if (!plainRecord(result) || typeof result.expectedTradeDate !== "string"
        || typeof result.evaluatedTradeDate !== "string"
        || !versionString(result.resultVersion) || !versionString(result.calendarVersion)) return false;
    }
  }
  return true;
}

export function evaluateBollingerShadow(value: unknown): Phase8EvaluationOutput {
  // The external-data boundary also contains exceptional object/property behavior.
  try {
    if (plainRecord(value) && value.readOnly === false) {
      return failed("READ_ONLY_GUARD_FAILED", "READ_ONLY_REQUIRED");
    }
    if (!inputShape(value)) return failed("INVALID_DATA", "INVALID_INPUT_STRUCTURE");
    return evaluateValidated(value);
  } catch (error) {
    return failed("INVALID_DATA", error instanceof InvalidAggregate
      ? "NON_FINITE_AGGREGATE" : "INVALID_INPUT_STRUCTURE");
  }
}

function evaluateValidated(input: Phase8EvaluationInput): Phase8EvaluationOutput {
  const threshold = PHASE_8_MINIMUM_SAMPLE_THRESHOLD;
  // V1 status precedence: read-only guard (at boundary), invalid data, version, calendar.
  // Invalid-data reason precedence: structure, threshold, metadata, event, result,
  // snapshot conflict, logical duplicate, aggregate overflow. Each pass covers the
  // entire batch before a lower-priority reason is considered.
  if (input.minimumSampleThreshold !== undefined && input.minimumSampleThreshold !== threshold) {
    return failed("INVALID_DATA", "INVALID_MINIMUM_SAMPLE_THRESHOLD");
  }
  if (!validSourceCutoff(input.sourceCutoff)) return failed("INVALID_DATA", "INVALID_METADATA");
  if (input.events.some((event) =>
    !Number.isSafeInteger(event.eventId) || event.eventId <= 0
    || !Number.isSafeInteger(event.snapshotId) || event.snapshotId <= 0 || !event.code.trim()
    || !validDateOnly(event.observationDate) || event.observationDate > input.sourceCutoff.slice(0, 10)
    || !SIDES.includes(event.side) || !SIGMA_LEVELS.includes(event.sigmaLevel)
    || !EVENT_TYPES.includes(event.eventType))
    || uniqueCount(input.events.map((event) => event.eventId)) !== input.events.length) {
    return failed("INVALID_DATA", "INVALID_EVENT_DATA");
  }
  if (input.events.some((event) =>
    uniqueCount(event.results.map((result) => result.horizon)) !== event.results.length
    || event.results.some((result) =>
      !PHASE_8_HORIZONS.includes(result.horizon)
      || ![result.returnPercent, result.maxRisePercent, result.maxDrawdownPercent].every(Number.isFinite)
      || !validDateOnly(result.expectedTradeDate) || !validDateOnly(result.evaluatedTradeDate)))) {
    return failed("INVALID_DATA", "INVALID_RESULT_DATA");
  }

  // Domain identities are validated before sorting; neither caller array is mutated.
  const orderedEvents = [...input.events].sort((left, right) => left.eventId - right.eventId)
    .map((event) => ({ ...event, results: [...event.results].sort((left, right) => left.horizon - right.horizon) }));
  const logicalIds = new Set<string>();
  const snapshots = new Map<number, { code: string; observationDate: string }>();
  let snapshotConflict = false;
  let logicalDuplicate = false;
  for (const event of orderedEvents) {
    const snapshot = snapshots.get(event.snapshotId);
    if (snapshot && (snapshot.code !== event.code || snapshot.observationDate !== event.observationDate)) {
      snapshotConflict = true;
    }
    snapshots.set(event.snapshotId, { code: event.code, observationDate: event.observationDate });
    const logicalId = canonicalize([event.snapshotId, event.side, event.sigmaLevel, event.eventType]);
    if (logicalIds.has(logicalId)) logicalDuplicate = true;
    logicalIds.add(logicalId);
  }
  if (snapshotConflict) return failed("INVALID_DATA", "SNAPSHOT_METADATA_CONFLICT");
  if (logicalDuplicate) return failed("INVALID_DATA", "DUPLICATE_LOGICAL_EVENT");

  const versionErrors = new Set<string>();
  if (input.evaluationVersion !== PHASE_8_EVALUATION_VERSION
    || input.cohortDefinitionVersion !== PHASE_8_COHORT_DEFINITION_VERSION) {
    versionErrors.add("UNSUPPORTED_EVALUATION_VERSION");
  }
  let calendarMismatch = false;
  for (const event of orderedEvents) {
    if (event.detectorVersion !== input.detectorVersion) versionErrors.add("DETECTOR_VERSION_MISMATCH");
    for (const result of event.results) {
      if (result.resultVersion !== input.resultVersion) versionErrors.add("RESULT_VERSION_MISMATCH");
      if (result.calendarVersion !== input.calendarVersion) versionErrors.add("CALENDAR_VERSION_MISMATCH");
      if (result.expectedTradeDate !== result.evaluatedTradeDate
        || result.evaluatedTradeDate <= event.observationDate
        || result.evaluatedTradeDate > input.sourceCutoff.slice(0, 10)) calendarMismatch = true;
    }
  }
  // Detect arithmetic INVALID_DATA before lower-priority version/calendar failures.
  // Computed cohorts remain private and are discarded on any failure.
  const cohorts = COHORT_DEFINITIONS.map((definition) => cohortEvaluation(definition, orderedEvents, threshold));
  // Within VERSION_MISMATCH, ASCII error-code order is the fixed V1 reason precedence.
  if (versionErrors.size > 0) return failed("VERSION_MISMATCH", [...versionErrors].sort()[0]);
  if (calendarMismatch) return failed("CALENDAR_MISMATCH", "RESULT_CALENDAR_MISMATCH");
  const allHorizons = cohorts[0].horizons;
  const status = allHorizons.some((horizon) => horizon.status === "INSUFFICIENT_SAMPLE")
    ? "INSUFFICIENT_SAMPLE" : allHorizons.some((horizon) => horizon.status === "INCOMPLETE_DATA")
      ? "INCOMPLETE_DATA" : "COMPLETE";
  return { status, metadata: baseMetadata(input, threshold), cohorts };
}
