import { pathToFileURL } from "node:url";

export const PHASE_7_1_CONFIG = Object.freeze({
  devProjectRef: "jdtqwryiyxeuoraecorw",
  productionProjectRef: "paygtakajhvatwejygda",
  leaseSeconds: 300,
  hardTimeoutSeconds: 225,
  limit: 20,
  concurrency: 1,
  requestTimeoutMs: 8_000,
  broadFailureThreshold: Object.freeze({ minimumAffectedSymbols: 2, affectedRatio: 0.10 }),
});

const EXECUTION_SOURCE = "PHASE_7_SHADOW_AUTOMATION";
const PHASE = "7";
const LOCK_KEYS = Object.freeze({
  OBSERVATION: "signalx-technical-bb-shadow-observation",
  RESULTS: "signalx-technical-bb-shadow-results",
});
const TECHNICAL_BB_TABLES = Object.freeze([
  "technical_bb_observation_snapshots",
  "technical_bb_observation_events",
  "technical_bb_observation_results",
]);

export class BollingerShadowDevAdapterError extends Error {
  constructor(code) { super(code); this.name = "BollingerShadowDevAdapterError"; this.code = code; }
}

function validateInput(operation, mode, environment) {
  if (!(["OBSERVATION", "RESULTS"]).includes(operation)) throw new BollingerShadowDevAdapterError("INVALID_OPERATION");
  if (!(["PREVIEW", "SAVE"]).includes(mode)) throw new BollingerShadowDevAdapterError("INVALID_MODE");
  if (environment.TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED !== "true") {
    throw new BollingerShadowDevAdapterError("KILL_SWITCH_OFF");
  }
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new BollingerShadowDevAdapterError("DEV_DATABASE_UNCONFIRMED");
  let parsed;
  try { parsed = new URL(databaseUrl); } catch { throw new BollingerShadowDevAdapterError("DEV_DATABASE_UNCONFIRMED"); }
  const identity = `${parsed.hostname}:${decodeURIComponent(parsed.username)}`;
  if (identity.includes(PHASE_7_1_CONFIG.productionProjectRef)) {
    throw new BollingerShadowDevAdapterError("PRODUCTION_DATABASE_REJECTED");
  }
  if (!identity.includes(PHASE_7_1_CONFIG.devProjectRef)) {
    throw new BollingerShadowDevAdapterError("DEV_DATABASE_UNCONFIRMED");
  }
  return databaseUrl;
}

function jstDate(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric",
    month: "2-digit", day: "2-digit" }).format(date);
}

async function technicalBbState(database) {
  const state = {};
  for (const table of TECHNICAL_BB_TABLES) {
    const result = await database.query(`SELECT COUNT(*)::int AS count,
      md5(COALESCE(string_agg(row_to_json(t)::text, '|' ORDER BY t.id), '')) AS digest
      FROM public.${table} t`);
    state[table] = {
      count: Number(result.rows[0]?.count ?? 0),
      digest: typeof result.rows[0]?.digest === "string" ? result.rows[0].digest : null,
    };
  }
  return state;
}

async function lockPresent(database, operation) {
  const result = await database.query(
    "SELECT EXISTS(SELECT 1 FROM public.cron_execution_locks WHERE lock_key=$1) AS present",
    [LOCK_KEYS[operation]],
  );
  return result.rows[0]?.present === true;
}

function candidateCount(operation, result) {
  if (operation === "OBSERVATION") return Number(result.runner?.candidateEvents ?? 0);
  return Number(result.runner?.candidateResults ?? 0);
}

function safeAuditSummary({ operation, mode, result, runtimeMilliseconds, before, after,
  lockPresentAfterRun, error }) {
  const locked = result?.status === "LOCKED";
  const fetchFailures = Number(result?.fetchFailures ?? 0);
  const http429 = Number(result?.http429 ?? 0);
  const timeout = Number(result?.timeout ?? 0);
  const tablesUnchanged = mode === "PREVIEW" ? JSON.stringify(before) === JSON.stringify(after) : null;
  const auditFailure = !locked && lockPresentAfterRun ? "LOCK_NOT_RELEASED"
    : tablesUnchanged === false ? "PREVIEW_DB_CHANGED" : null;
  return {
    operation,
    mode,
    status: error || auditFailure ? "FAILED" : result.status,
    ...(error ? { reason: typeof error?.code === "string" ? error.code : "AUTOMATION_FAILED" }
      : auditFailure ? { reason: auditFailure } : result.reason ? { reason: result.reason } : {}),
    devConfirmed: result?.devConfirmed === true,
    expectedDevProjectRefMatched: true,
    shadowOnly: result?.shadowOnly === true,
    executionSource: result?.executionSource ?? EXECUTION_SOURCE,
    phase: PHASE,
    manualExecutionPresent: false,
    requested: Number(result?.requested ?? 0),
    processed: Number(result?.processed ?? 0),
    candidateCount: candidateCount(operation, result ?? {}),
    created: Number(result?.created ?? 0),
    existing: Number(result?.existing ?? 0),
    failed: Number(result?.failed ?? (error ? 1 : 0)),
    yahooHttpFailure: Math.max(0, fetchFailures - http429 - timeout),
    http429,
    timeout,
    freshnessMismatch: Number(result?.freshnessMismatch ?? 0),
    canonicalMismatch: Number(result?.canonicalMismatch ?? 0),
    lockStatus: locked ? "LOCKED" : error || result ? "ACQUIRED" : "UNKNOWN",
    lockReleased: locked ? null : !lockPresentAfterRun,
    lockPresentAfterRun,
    runtimeMilliseconds,
    technicalBbPersistenceAttempted: mode === "SAVE" && !locked,
    technicalBbTablesUnchanged: tablesUnchanged,
    productionConsumerInvoked: false,
  };
}

export async function runBollingerShadowDevAdapter(input, dependencies = {}) {
  const environment = input.environment ?? process.env;
  const databaseUrl = validateInput(input.operation, input.mode, environment);
  const now = input.now ?? new Date();
  const technical = dependencies.technical ?? await import("../app/lib/technicalObservation/bollingerShadowAutomation.ts");
  const stocksModule = dependencies.stocksModule ?? await import("../app/lib/activeStockList.ts");
  let database = dependencies.database;
  let ownsDatabase = false;
  if (!database) {
    const { default: pg } = await import("pg");
    database = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    ownsDatabase = true;
  }
  const common = {
    mode: input.mode,
    limit: PHASE_7_1_CONFIG.limit,
    targetTradeDate: jstDate(now),
    now,
    concurrency: PHASE_7_1_CONFIG.concurrency,
    timeoutMs: PHASE_7_1_CONFIG.requestTimeoutMs,
    broadFailureThreshold: PHASE_7_1_CONFIG.broadFailureThreshold,
    lockLeaseSeconds: PHASE_7_1_CONFIG.leaseSeconds,
    environment,
    databaseUrl,
    database,
  };
  const startedAt = Date.now();
  const before = input.mode === "PREVIEW" ? await technicalBbState(database) : null;
  let result;
  let operationError;
  try {
    if (input.operation === "OBSERVATION") {
      const stocks = stocksModule.ACTIVE_STOCKS.slice(0, PHASE_7_1_CONFIG.limit);
      if (stocks.length !== PHASE_7_1_CONFIG.limit) throw new BollingerShadowDevAdapterError("FIXED_CHUNK_UNAVAILABLE");
      result = await technical.runBollingerShadowObservation({ ...common, stocks });
    } else {
      result = await technical.runBollingerShadowResults(common);
    }
  } catch (error) {
    operationError = error;
  }
  try {
    const after = input.mode === "PREVIEW" ? await technicalBbState(database) : null;
    const present = await lockPresent(database, input.operation);
    return safeAuditSummary({ operation: input.operation, mode: input.mode, result, error: operationError,
      before, after, lockPresentAfterRun: present, runtimeMilliseconds: Date.now() - startedAt });
  } finally {
    if (ownsDatabase) await database.end();
  }
}

function safeOutput(value) {
  return JSON.stringify(value, (_key, item) => item instanceof Error ? undefined : item);
}

async function main() {
  const operation = process.argv[2];
  const mode = process.argv[3] ?? "PREVIEW";
  const timeout = setTimeout(() => {
    process.stderr.write(safeOutput({ status: "FAILED", code: "HARD_TIMEOUT",
      hardTimeoutSeconds: PHASE_7_1_CONFIG.hardTimeoutSeconds }) + "\n");
    process.exit(124);
  }, PHASE_7_1_CONFIG.hardTimeoutSeconds * 1_000);
  try {
    const result = await runBollingerShadowDevAdapter({ operation, mode });
    process.stdout.write(safeOutput(result) + "\n");
    if (result.status === "LOCKED") process.exitCode = 2;
    else if (result.status === "FAILED") process.exitCode = 1;
  } catch (error) {
    const code = error instanceof BollingerShadowDevAdapterError ? error.code
      : typeof error?.code === "string" ? error.code : "ADAPTER_FAILED";
    process.stderr.write(safeOutput({ status: "FAILED", code }) + "\n");
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
