import { PHASE7_ACQUIRE_LOCK_SQL, PHASE7_RELEASE_LOCK_SQL, PHASE7_CAP_ACQUIRE_SQL, PHASE7_CAP_RELEASE_SQL, PHASE7_DIGEST_SQL, PHASE7_OWN_LOCK_PRESENT_SQL } from "../app/lib/technicalObservation/bollingerShadowQueries.ts";
import { pathToFileURL } from "node:url";
import { resolveTargetTradeDate, TseMarketCalendarError } from
  "../app/lib/technicalObservation/tseMarketCalendar.ts";

import { validatePhase7OfflineDestination, validatePhase7DedicatedDestination,
  validatePhase7SessionPoolerDestination, openPhase7Session, Phase7SecurityError } from
  "../app/lib/technicalObservation/bollingerShadowDevSecurity.ts";

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

function validateInput(operation, mode, environment, offlineTest, connectionMethod, trustedCaPem) {
  if (!(["OBSERVATION", "RESULTS"]).includes(operation)) throw new BollingerShadowDevAdapterError("INVALID_OPERATION");
  if (!(["PREVIEW", "SAVE"]).includes(mode)) throw new BollingerShadowDevAdapterError("INVALID_MODE");
  if (environment.TECHNICAL_BB_SHADOW_AUTOMATION_ENABLED !== "true") {
    throw new BollingerShadowDevAdapterError("KILL_SWITCH_OFF");
  }
  const databaseUrl = environment.DATABASE_URL;
  try { (offlineTest ? validatePhase7OfflineDestination
    : connectionMethod === "SESSION_POOLER_IPV4" ? value => validatePhase7SessionPoolerDestination(value, trustedCaPem)
    : validatePhase7DedicatedDestination)(databaseUrl); }
  catch (error) { throw new BollingerShadowDevAdapterError(error instanceof Phase7SecurityError ? error.code : "DEV_DATABASE_UNCONFIRMED"); }
  return databaseUrl;
}

async function technicalBbState(database) {
  const state = {};
  for (const table of TECHNICAL_BB_TABLES) {
    const result = await database.query(PHASE7_DIGEST_SQL[TECHNICAL_BB_TABLES.indexOf(table)]);
    state[table] = {
      count: Number(result.rows[0]?.count ?? 0),
      digest: typeof result.rows[0]?.digest === "string" ? result.rows[0].digest : null,
    };
  }
  return state;
}

async function lockPresent(database, operation, ownerId) {
  const result = await database.query(
    PHASE7_OWN_LOCK_PRESENT_SQL,
    [LOCK_KEYS[operation], ownerId],
  );
  return result.rows[0]?.present === true;
}

function candidateCount(operation, result) {
  if (operation === "OBSERVATION") return Number(result.runner?.candidateEvents ?? 0);
  return Number(result.runner?.candidateResults ?? 0);
}

function safeAuditSummary({ operation, mode, result, runtimeMilliseconds, before, after,
  lockPresentAfterRun, error, target }) {
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
    runNowJst: target.runNowJst,
    targetTradeDate: target.targetTradeDate,
    targetTradeDateReason: target.targetTradeDateReason,
    marketCalendarVersion: target.marketCalendarVersion,
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
    freshnessDiagnostics: Array.isArray(result?.freshnessDiagnostics) ? result.freshnessDiagnostics : [],
    freshnessDiagnosticsTruncated: result?.freshnessDiagnosticsTruncated === true,
    resultCalendarDiagnostics: Array.isArray(result?.resultCalendarDiagnostics)
      ? result.resultCalendarDiagnostics : [],
    resultCalendarDiagnosticsTruncated: result?.resultCalendarDiagnosticsTruncated === true,
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
  if (dependencies.offlineTest && !input.environment) throw new Phase7SecurityError("OFFLINE_DEPENDENCIES_REQUIRED");
  const environment = input.environment ?? process.env;
  const connectionMethod = environment.PHASE7_DEV_CONNECTION_METHOD ?? "DIRECT_DEV";
  if (connectionMethod !== "DIRECT_DEV" && connectionMethod !== "SESSION_POOLER_IPV4")
    throw new Phase7SecurityError("INVALID_CONNECTION_METHOD");
  if (dependencies.offlineTest && connectionMethod !== "DIRECT_DEV")
    throw new Phase7SecurityError("OFFLINE_DEPENDENCIES_REQUIRED");
  let trustedCaPem;
  if (connectionMethod === "SESSION_POOLER_IPV4") {
    // CA file is local configuration, never a database password or remote fetch.
    const caPath = environment.PHASE7_DEV_POOLER_CA_FILE;
    if (typeof caPath !== "string" || !caPath || !/\.(?:crt|cer|pem)$/i.test(caPath))
      throw new Phase7SecurityError("POOLER_CA_FILE_REQUIRED");
    try {
      const { lstat, readFile } = await import("node:fs/promises");
      const { isAbsolute } = await import("node:path");
      if (!isAbsolute(caPath)) throw new Error("NOT_ABSOLUTE");
      const stat = await lstat(caPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 200_000)
        throw new Error("NOT_REGULAR_CA");
      trustedCaPem = await readFile(caPath, "utf8");
    } catch { throw new Phase7SecurityError("POOLER_CA_FILE_UNAVAILABLE"); }
  } else if (environment.PHASE7_DEV_POOLER_CA_FILE) {
    throw new Phase7SecurityError("POOLER_CA_UNEXPECTED");
  }
  const databaseUrl = validateInput(input.operation, input.mode, environment,
    dependencies.offlineTest, connectionMethod, trustedCaPem);
  dependencies = { ...dependencies };
  if (dependencies.offlineTest && (typeof dependencies.createClient !== "function" || typeof dependencies.observe !== "function" || dependencies.loadClient))
    throw new Phase7SecurityError("OFFLINE_DEPENDENCIES_REQUIRED");
  const now = input.now ?? new Date();
  if (dependencies.offlineTest && (!dependencies.technical || !dependencies.stocksModule))
    throw new Phase7SecurityError("OFFLINE_DEPENDENCIES_REQUIRED");
  const target = (dependencies.resolveTargetTradeDate ?? resolveTargetTradeDate)(now);
  if (dependencies.database) throw new Phase7SecurityError("VERIFIED_DATABASE_REQUIRED");
  let ownerId;
  let session, result, operationError, before, after, present = null, audit;
  const startedAt = Date.now();
  try {
    session = await openPhase7Session(databaseUrl, input.mode, {
      ...dependencies, signal: dependencies.signal, connectionMethod, trustedCaPem,
      loadClient: dependencies.createClient ? undefined : dependencies.loadClient ?? (async () => {
        const { setDefaultAutoSelectFamily } = await import("node:net");
        setDefaultAutoSelectFamily(false);
        const { default: Client } = await import("pg/lib/client.js");
        return options => new Client(options);
      }),
    });
    await session.run(async () => {
      const technical = dependencies.technical ?? await import("../app/lib/technicalObservation/bollingerShadowAutomation.ts");
      const stocksModule = dependencies.stocksModule ?? await import("../app/lib/activeStockList.ts");
      session.check();
      const common = { mode: input.mode, limit: PHASE_7_1_CONFIG.limit, targetTradeDate: target.targetTradeDate,
        now, concurrency: PHASE_7_1_CONFIG.concurrency, timeoutMs: PHASE_7_1_CONFIG.requestTimeoutMs,
        broadFailureThreshold: PHASE_7_1_CONFIG.broadFailureThreshold, lockLeaseSeconds: PHASE_7_1_CONFIG.leaseSeconds,
        environment, databaseUrl, database: session.database,
        acquireLock: async (operation, owner, leaseSeconds, database, secretHex) => {
          // Retain run identity for audit. Never serialize or log the secret.
          ownerId = owner;
          if (secretHex) {
            const acquired = await database.query(PHASE7_CAP_ACQUIRE_SQL,
              [LOCK_KEYS[operation], owner, secretHex, leaseSeconds]);
            return acquired.rows.length === 1 && acquired.rows[0]?.acquired === true;
          }
          // Offline-only legacy fixtures. Real DEV session rejects this SQL.
          const acquired = await database.query(PHASE7_ACQUIRE_LOCK_SQL, [LOCK_KEYS[operation], owner, leaseSeconds]);
          return Boolean(acquired.rows[0]);
        },
        releaseLock: async (operation, owner, database, secretHex) => {
          if (secretHex) {
            const released = await database.query(PHASE7_CAP_RELEASE_SQL,
              [LOCK_KEYS[operation], owner, secretHex]);
            if (released.rows.length !== 1 || released.rows[0]?.released !== true)
              throw new BollingerShadowDevAdapterError("CAPABILITY_RELEASE_FAILED");
            return;
          }
          await database.query(PHASE7_RELEASE_LOCK_SQL, [LOCK_KEYS[operation], owner]);
        } };
      before = input.mode === "PREVIEW" ? await technicalBbState(session.database) : null;
      try {
        if (input.operation === "OBSERVATION") {
          const stocks = stocksModule.ACTIVE_STOCKS.slice(0, PHASE_7_1_CONFIG.limit);
          if (stocks.length !== PHASE_7_1_CONFIG.limit) throw new BollingerShadowDevAdapterError("FIXED_CHUNK_UNAVAILABLE");
          result = await technical.runBollingerShadowObservation({ ...common, stocks });
        } else result = await technical.runBollingerShadowResults(common);
      } catch (error) { operationError = error; }
      session.check();
      after = input.mode === "PREVIEW" ? await technicalBbState(session.database) : null;
      present = ownerId === undefined ? null : await lockPresent(session.database, input.operation, ownerId);
    });
  } catch (error) { operationError = error; audit = error instanceof Phase7SecurityError ? error.audit : undefined; }
  finally { if (session) audit = await session.close(); }
  const coreCodes = new Set(["INVALID_PROVENANCE", "RESULT_GATE_FAILED", "KILL_SWITCH_OFF", "INVALID_MODE"]);
  const sanitized = operationError ? { code: operationError instanceof Phase7SecurityError
    || operationError instanceof BollingerShadowDevAdapterError || coreCodes.has(operationError?.code)
    ? operationError.code : "AUTOMATION_FAILED" } : null;
  const summary = safeAuditSummary({ operation: input.operation, mode: input.mode, result, error: sanitized,
    before, after, lockPresentAfterRun: present, runtimeMilliseconds: Date.now() - startedAt, target });
  if (present === null) { summary.lockReleased = null; summary.lockPresentAfterRun = null; }
  summary.technicalBbPersistenceAttempted = audit?.persistenceAttempted === true;
  if (input.mode === "PREVIEW" && (before === undefined || after === undefined)) summary.technicalBbTablesUnchanged = null;
  if (operationError && input.mode === "SAVE" && !result && audit?.partialPersistencePossible) { summary.created = null; summary.existing = null; }
  if (audit?.databaseError) { summary.status = "FAILED"; summary.reason = "DATABASE_FAILED"; }
  if (audit?.cancelled) { summary.status = "FAILED"; summary.reason = "CANCELLED"; }
  if (audit?.cleanupFailed) { summary.status = "FAILED"; summary.reason = "CLEANUP_FAILED"; }
  return { ...summary, security: audit ?? null,
    partialPersistencePossible: Boolean(audit?.partialPersistencePossible || (input.mode === "SAVE" && result?.created > 0)),
    persistenceOutcome: audit?.commitOutcomeUnknown ? "UNKNOWN" : audit?.commitsAcknowledged ? "COMMITTED_TRANSACTIONS" : "NO_COMMIT_ACKNOWLEDGED" };
}

function safeOutput(value) {
  return JSON.stringify(value, (_key, item) => item instanceof Error ? undefined : item);
}

async function main() {
  const operation = process.argv[2];
  const mode = process.argv[3] ?? "PREVIEW";
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on("SIGINT", cancel); process.on("SIGTERM", cancel);
  try {
    if (process.argv.length < 3 || process.argv.length > 4) throw new BollingerShadowDevAdapterError("INVALID_ARGUMENTS");
    const result = await runBollingerShadowDevAdapter({ operation, mode }, { signal: controller.signal });
    process.stdout.write(safeOutput(result) + "\n");
    if (result.status === "LOCKED") process.exitCode = 2;
    else if (result.status === "FAILED") process.exitCode = 1;
  } catch (error) {
    const code = error instanceof BollingerShadowDevAdapterError || error instanceof TseMarketCalendarError
      || error instanceof Phase7SecurityError ? error.code : "ADAPTER_FAILED";
    process.stderr.write(safeOutput({ status: "FAILED", code }) + "\n");
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", cancel); process.removeListener("SIGTERM", cancel);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
