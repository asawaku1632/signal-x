import type {
  BollingerObservationCalculation,
  BollingerObservationEvent,
  BollingerObservationEvidence,
  BollingerObservationTimeframe,
} from "./bollingerObservationTypes.ts";
import { BOLLINGER_OBSERVATION_DETECTOR_VERSION } from "./bollingerObservationTypes.ts";

export type BollingerObservationPersistenceInput = {
  code: string;
  observationDate: string;
  timeframe: BollingerObservationTimeframe;
  close: number;
  calculation: BollingerObservationCalculation;
  evidence: BollingerObservationEvidence;
  events: readonly BollingerObservationEvent[];
  detectorVersion: typeof BOLLINGER_OBSERVATION_DETECTOR_VERSION;
  provider: string;
  providerTimestamp?: string | Date | null;
  barStartAt: string | Date;
  barEndAt: string | Date;
  timezone: string;
  metadata?: Readonly<Record<string, unknown>>;
};

export type BollingerSnapshotRow = {
  code: string; observation_date: string; timeframe: BollingerObservationTimeframe;
  close: number; bb_period: 20; bb_middle: number; standard_deviation: number;
  bb_upper_1: number; bb_upper_2: number; bb_upper_3: number;
  bb_lower_1: number; bb_lower_2: number; bb_lower_3: number; bb_sigma_position: number;
  detector_version: typeof BOLLINGER_OBSERVATION_DETECTOR_VERSION;
  provider: string; provider_timestamp: string | null; bar_start_at: string; bar_end_at: string;
  timezone: string; rsi14: number | null; macd: number | null; macd_signal: number | null;
  macd_histogram: number | null; macd_cross: "GOLDEN_CROSS" | "DEAD_CROSS" | null;
  ema20: number | null; ema75: number | null; ema200: number | null; atr14: number | null;
  volume_ratio_20: number | null; rsi_availability: string; macd_availability: string;
  ema_availability: string; atr_availability: string; volume_ratio_availability: string;
  metadata: Readonly<Record<string, unknown>>;
};

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };
type QueryClient = { query(text: string, values?: unknown[]): Promise<QueryResult>; release(): void };
export type BollingerObservationDatabase = { connect(): Promise<QueryClient> };

const SNAPSHOT_COLUMNS = [
  "code", "observation_date", "timeframe", "close", "bb_period", "bb_middle",
  "standard_deviation", "bb_upper_1", "bb_upper_2", "bb_upper_3", "bb_lower_1",
  "bb_lower_2", "bb_lower_3", "bb_sigma_position", "detector_version", "provider",
  "provider_timestamp", "bar_start_at", "bar_end_at", "timezone", "rsi14", "macd",
  "macd_signal", "macd_histogram", "macd_cross", "ema20", "ema75", "ema200", "atr14",
  "volume_ratio_20", "rsi_availability", "macd_availability", "ema_availability",
  "atr_availability", "volume_ratio_availability", "metadata",
] as const;

const NUMERIC_COLUMNS = new Set([
  "close", "bb_period", "bb_middle", "standard_deviation", "bb_upper_1", "bb_upper_2",
  "bb_upper_3", "bb_lower_1", "bb_lower_2", "bb_lower_3", "bb_sigma_position", "rsi14",
  "macd", "macd_signal", "macd_histogram", "ema20", "ema75", "ema200", "atr14",
  "volume_ratio_20",
]);
const TIMESTAMP_COLUMNS = new Set(["provider_timestamp", "bar_start_at", "bar_end_at"]);
const DATE_COLUMNS = new Set(["observation_date"]);
const AVAILABILITIES = new Set(["AVAILABLE", "UNAVAILABLE", "INSUFFICIENT_HISTORY", "INVALID"]);

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function canonicalNumericEqual(actual: unknown, expected: unknown): boolean {
  return (actual === null && expected === null)
    || (actual !== null && expected !== null
      && Number.isFinite(Number(actual)) && Number(actual) === Number(expected));
}

function instant(value: string | Date | null | undefined, required: boolean): string | null {
  if (value === null || value === undefined) {
    if (required) throw new Error("INVALID_TIMESTAMP");
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_TIMESTAMP");
  return date.toISOString();
}

function plainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validateEvidence(input: BollingerObservationEvidence) {
  const entries = [input.indicators.rsi, input.indicators.macd, input.indicators.ema,
    input.indicators.atr, input.indicators.volumeRatio];
  if (entries.some((item) => !AVAILABILITIES.has(item.availability))) {
    throw new Error("INVALID_EVIDENCE_AVAILABILITY");
  }
  const { rsi, macd, ema, atr, volumeRatio } = input.indicators;
  if (rsi.value !== null && !finite(rsi.value)) throw new Error("INVALID_RSI");
  if (rsi.availability === "AVAILABLE" && !finite(rsi.value)) throw new Error("AVAILABLE_RSI_MISSING");
  const macdValues = [macd.value.macd, macd.value.signal, macd.value.histogram];
  if (macdValues.some((value) => value !== null && !finite(value))) throw new Error("INVALID_MACD");
  if (macd.availability === "AVAILABLE" && !macdValues.every(finite)) {
    throw new Error("AVAILABLE_MACD_MISSING");
  }
  if (macd.value.cross !== null && !["GOLDEN_CROSS", "DEAD_CROSS"].includes(macd.value.cross)) {
    throw new Error("INVALID_MACD_CROSS");
  }
  if (macd.value.cross !== null && macd.availability !== "AVAILABLE") {
    throw new Error("MACD_CROSS_WITHOUT_AVAILABLE_MACD");
  }
  const emaValues = [ema.value.ema20, ema.value.ema75, ema.value.ema200];
  if (emaValues.some((value) => value !== null && !finite(value))) throw new Error("INVALID_EMA");
  if (ema.availability === "AVAILABLE" && !emaValues.every(finite)) {
    throw new Error("AVAILABLE_EMA_MISSING");
  }
  if (atr.value !== null && !finite(atr.value)) throw new Error("INVALID_ATR");
  if (atr.availability === "AVAILABLE" && !finite(atr.value)) throw new Error("AVAILABLE_ATR_MISSING");
  if (volumeRatio.value !== null && !finite(volumeRatio.value)) throw new Error("INVALID_VOLUME_RATIO");
  if (volumeRatio.availability === "AVAILABLE" && !finite(volumeRatio.value)) {
    throw new Error("AVAILABLE_VOLUME_RATIO_MISSING");
  }
}

export function mapBollingerObservationSnapshot(
  input: BollingerObservationPersistenceInput,
): BollingerSnapshotRow {
  if (!input.code.trim()) throw new Error("INVALID_CODE");
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.observationDate)
    || Number.isNaN(Date.parse(`${input.observationDate}T00:00:00Z`))) {
    throw new Error("INVALID_OBSERVATION_DATE");
  }
  if (!(["1D", "1W"] as const).includes(input.timeframe)) throw new Error("INVALID_TIMEFRAME");
  if (input.calculation.timeframe !== input.timeframe) throw new Error("TIMEFRAME_MISMATCH");
  if (input.calculation.reason !== null || input.calculation.period !== 20) {
    throw new Error("INVALID_BOLLINGER_CALCULATION");
  }
  if (!finite(input.close) || input.close <= 0) throw new Error("INVALID_CLOSE");
  const bands = [input.calculation.bbMiddle, input.calculation.standardDeviation,
    input.calculation.bbUpper1, input.calculation.bbUpper2, input.calculation.bbUpper3,
    input.calculation.bbLower1, input.calculation.bbLower2, input.calculation.bbLower3,
    input.calculation.bbSigmaPosition];
  if (!bands.every(finite)) throw new Error("INVALID_BOLLINGER_VALUE");
  if (input.calculation.standardDeviation! <= 0) throw new Error("INVALID_STANDARD_DEVIATION");
  if (input.detectorVersion !== BOLLINGER_OBSERVATION_DETECTOR_VERSION) {
    throw new Error("INVALID_DETECTOR_VERSION");
  }
  if (!input.provider.trim() || !input.timezone.trim()) throw new Error("INVALID_SOURCE_METADATA");
  const barStartAt = instant(input.barStartAt, true)!;
  const barEndAt = instant(input.barEndAt, true)!;
  if (Date.parse(barStartAt) >= Date.parse(barEndAt)) throw new Error("INVALID_BAR_RANGE");
  const metadata = input.metadata ?? {};
  if (!plainObject(metadata)) throw new Error("INVALID_METADATA");
  validateEvidence(input.evidence);
  const { rsi, macd, ema, atr, volumeRatio } = input.evidence.indicators;
  return {
    code: input.code.trim(), observation_date: input.observationDate, timeframe: input.timeframe,
    close: input.close, bb_period: 20, bb_middle: input.calculation.bbMiddle!,
    standard_deviation: input.calculation.standardDeviation!, bb_upper_1: input.calculation.bbUpper1!,
    bb_upper_2: input.calculation.bbUpper2!, bb_upper_3: input.calculation.bbUpper3!,
    bb_lower_1: input.calculation.bbLower1!, bb_lower_2: input.calculation.bbLower2!,
    bb_lower_3: input.calculation.bbLower3!, bb_sigma_position: input.calculation.bbSigmaPosition!,
    detector_version: input.detectorVersion, provider: input.provider.trim(),
    provider_timestamp: instant(input.providerTimestamp, false), bar_start_at: barStartAt,
    bar_end_at: barEndAt, timezone: input.timezone.trim(), rsi14: rsi.value,
    macd: macd.value.macd, macd_signal: macd.value.signal, macd_histogram: macd.value.histogram,
    macd_cross: macd.value.cross, ema20: ema.value.ema20, ema75: ema.value.ema75,
    ema200: ema.value.ema200, atr14: atr.value, volume_ratio_20: volumeRatio.value,
    rsi_availability: rsi.availability, macd_availability: macd.availability,
    ema_availability: ema.availability, atr_availability: atr.availability,
    volume_ratio_availability: volumeRatio.availability,
    metadata: { ...metadata, evidenceDiagnostics: input.evidence.diagnostics },
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (plainObject(value)) return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function normalizeDateOnly(value: unknown): string | null {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1
      || probe.getUTCDate() !== day) return null;
    return value;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    // node-postgres parses PostgreSQL DATE as local calendar midnight. Local
    // calendar fields preserve that DATE without converting it into an instant.
    const year = String(value.getFullYear()).padStart(4, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}

export function findCanonicalSnapshotMismatch(row: Record<string, unknown>, expected: BollingerSnapshotRow) {
  for (const column of SNAPSHOT_COLUMNS) {
    const actual = row[column];
    const wanted = expected[column];
    const matches = column === "metadata"
      ? stable(typeof actual === "string" ? JSON.parse(actual) : actual) === stable(wanted)
      : NUMERIC_COLUMNS.has(column)
        ? canonicalNumericEqual(actual, wanted)
        : DATE_COLUMNS.has(column)
          ? normalizeDateOnly(actual) !== null
            && normalizeDateOnly(actual) === normalizeDateOnly(wanted)
        : TIMESTAMP_COLUMNS.has(column)
          ? (actual === null && wanted === null)
            || (actual !== null && wanted !== null && new Date(actual as string | Date).toISOString() === wanted)
          : String(actual) === String(wanted);
    if (!matches) return column;
  }
  return null;
}

function validateEvents(events: readonly BollingerObservationEvent[]) {
  const keys = new Set<string>();
  for (const event of events) {
    if (!["LOWER", "UPPER"].includes(event.side) || ![2, 3].includes(event.sigmaLevel)
      || !["TOUCH", "CROSS", "CONTINUATION", "RETURN_INSIDE"].includes(event.type)) {
      throw new Error("INVALID_BOLLINGER_EVENT");
    }
    const key = `${event.side}:${event.sigmaLevel}:${event.type}`;
    if (keys.has(key)) throw new Error("DUPLICATE_INPUT_EVENT");
    keys.add(key);
  }
}

async function defaultDatabase(): Promise<BollingerObservationDatabase> {
  const { default: pool } = await import("../postgres.ts");
  return pool as unknown as BollingerObservationDatabase;
}

export async function saveBollingerObservation(
  input: BollingerObservationPersistenceInput,
  database?: BollingerObservationDatabase,
) {
  const snapshot = mapBollingerObservationSnapshot(input);
  validateEvents(input.events);
  const client = await (database ?? await defaultDatabase()).connect();
  try {
    await client.query("BEGIN");
    let selected = await client.query(
      `SELECT id, ${SNAPSHOT_COLUMNS.join(", ")} FROM technical_bb_observation_snapshots
       WHERE code=$1 AND timeframe=$2 AND bar_end_at=$3 AND detector_version=$4 FOR UPDATE`,
      [snapshot.code, snapshot.timeframe, snapshot.bar_end_at, snapshot.detector_version],
    );
    let snapshotId: number;
    let snapshotCreated = false;
    if (selected.rows[0]) {
      const mismatch = findCanonicalSnapshotMismatch(selected.rows[0], snapshot);
      if (mismatch) throw new Error(`CANONICAL_SNAPSHOT_MISMATCH:${mismatch}`);
      snapshotId = Number(selected.rows[0].id);
    } else {
      const values = SNAPSHOT_COLUMNS.map((column) =>
        column === "metadata" ? JSON.stringify(snapshot[column]) : snapshot[column]);
      const inserted = await client.query(
        `INSERT INTO technical_bb_observation_snapshots (${SNAPSHOT_COLUMNS.join(", ")})
         VALUES (${values.map((_, index) => `$${index + 1}${index === values.length - 1 ? "::jsonb" : ""}`).join(", ")})
         ON CONFLICT ON CONSTRAINT technical_bb_observation_snapshots_idempotency_key DO NOTHING
         RETURNING id`, values,
      );
      if (inserted.rows[0]) {
        snapshotId = Number(inserted.rows[0].id);
        snapshotCreated = true;
      } else {
        selected = await client.query(
          `SELECT id, ${SNAPSHOT_COLUMNS.join(", ")} FROM technical_bb_observation_snapshots
           WHERE code=$1 AND timeframe=$2 AND bar_end_at=$3 AND detector_version=$4 FOR UPDATE`,
          [snapshot.code, snapshot.timeframe, snapshot.bar_end_at, snapshot.detector_version],
        );
        if (!selected.rows[0]) throw new Error("SNAPSHOT_CONFLICT_NOT_FOUND");
        const mismatch = findCanonicalSnapshotMismatch(selected.rows[0], snapshot);
        if (mismatch) throw new Error(`CANONICAL_SNAPSHOT_MISMATCH:${mismatch}`);
        snapshotId = Number(selected.rows[0].id);
      }
    }
    if (!Number.isSafeInteger(snapshotId) || snapshotId <= 0) throw new Error("INVALID_SNAPSHOT_ID");
    let eventsCreated = 0;
    for (const event of input.events) {
      const inserted = await client.query(
        `INSERT INTO technical_bb_observation_events (snapshot_id,side,sigma_level,event_type)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ON CONSTRAINT technical_bb_observation_events_idempotency_key DO NOTHING`,
        [snapshotId, event.side, event.sigmaLevel, event.type],
      );
      eventsCreated += inserted.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return { snapshotId, snapshotCreated, eventsCreated };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
