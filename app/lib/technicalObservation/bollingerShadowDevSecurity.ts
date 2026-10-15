import {
  PHASE7_READ_SQL, PHASE7_IDENTITY_SQL, PHASE7_ROLE_PROOF_SQL, PHASE7_ROLLBACK_SQL, PHASE7_ACQUIRE_LOCK_SQL, PHASE7_RELEASE_LOCK_SQL, PHASE7_FENCE_LOCK_SQL,
  PHASE7_CAP_ACQUIRE_SQL, PHASE7_CAP_RELEASE_SQL, PHASE7_CAP_FENCE_SQL, PHASE7_CAP_BIND_SQL,
  PHASE7_CAP_ROLE_READY_SQL, phase7SqlRegistration,
} from "./bollingerShadowQueries.ts";
import { checkServerIdentity, type PeerCertificate } from "node:tls";
import { X509Certificate } from "node:crypto";
import { types } from "node:util";
import { performance } from "node:perf_hooks";

export const PHASE7_DEV_REF = "jdtqwryiyxeuoraecorw";
const HOST = `db.${PHASE7_DEV_REF}.supabase.co`;
const PROD = "paygtakajhvatwejygda";
// Explicitly allowlisted IPv4 session-pooler endpoint. No transaction pooler or fallback.
export const PHASE7_DEV_SESSION_POOLER_HOST = "aws-0-ap-northeast-1.pooler.supabase.com";
export const PHASE7_DEV_SESSION_POOLER_LOGIN = `signalx_phase7_writer.${PHASE7_DEV_REF}`;
export type Phase7ConnectionMethod = "DIRECT_DEV" | "SESSION_POOLER_IPV4";
export { PHASE7_ACQUIRE_LOCK_SQL, PHASE7_RELEASE_LOCK_SQL } from "./bollingerShadowQueries.ts";
export const PHASE7_SECURITY_LIMITS = Object.freeze({ connectionMs: 5000, statementMs: 8000,
  applicationMs: 225000, cleanupMs: 2000 });
export class Phase7SecurityError extends Error {
  readonly code: string;
  audit?: ReturnType<typeof emptyAudit>;
  constructor(code: string) { super(code); this.code = code; }
}
const requireThat = (condition: unknown, code: string) => { if (!condition) throw new Phase7SecurityError(code); };
// Exact, dedicated, non-superuser DEV account for real Phase 7 executions.
// Provisioning/role permissions are independent DBA actions. No production fallback.
export const PHASE7_DEDICATED_DEV_ROLE = "signalx_phase7_writer" as const;
function validatePhase7DestinationForRole(value: unknown, requiredUser: string) {
  requireThat(typeof value === "string" && value.length < 8192, "DEV_DATABASE_UNCONFIRMED");
  let parsed: URL, username: string, password: string;
  try {
    const text = value as string;
    requireThat(!/[\s\\]/.test(text) && !/%(?![0-9a-f]{2})/i.test(text), "DEV_DATABASE_UNCONFIRMED");
    parsed = new URL(text); username = decodeURIComponent(parsed.username); password = decodeURIComponent(parsed.password);
  } catch { throw new Phase7SecurityError("DEV_DATABASE_UNCONFIRMED"); }
  requireThat(!`${parsed.hostname}:${username}:${parsed.pathname}`.includes(PROD), "PRODUCTION_DATABASE_REJECTED");
  requireThat(["postgres:", "postgresql:"].includes(parsed.protocol) && parsed.hostname === HOST
    && username === requiredUser && parsed.pathname === "/postgres" && (!parsed.port || parsed.port === "5432")
    && !parsed.search && !parsed.hash && password.length > 0 && !/[\x00-\x1f\x7f]/.test(password), "DEV_DATABASE_UNCONFIRMED");
  // No connectionString or generic pool. Phase 7 lock and SAVE writes are intentional.
  return { host: HOST, port: 5432, database: "postgres", user: requiredUser, password,
    ssl: { rejectUnauthorized: true, servername: HOST }, replication: "false", sslnegotiation: "postgres",
    client_encoding: "UTF8", application_name: "phase7_shadow_manual",
    options: "-c default_transaction_read_only=off -c timezone=UTC -c datestyle=ISO,YMD -c search_path=public" };
}
// Dedicated writer login for Supavisor differs from its PostgreSQL current_role.
// The CA must be deliberately provided, verified and exclusively trusted for this socket.
export function validatePhase7TrustedPoolerCa(value: unknown): string {
  requireThat(typeof value === "string" && value.length > 0 && value.length <= 200_000,
    "POOLER_CA_REQUIRED");
  const pem = value as string;
  requireThat((pem.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length === 1
    && (pem.match(/-----END CERTIFICATE-----/g) ?? []).length === 1,
    "POOLER_CA_INVALID");
  try {
    const cert = new X509Certificate(pem);
    const from = new Date(cert.validFrom).getTime();
    const until = new Date(cert.validTo).getTime();
    requireThat(cert.ca && Number.isFinite(from) && Number.isFinite(until)
      && from <= Date.now() && Date.now() < until, "POOLER_CA_INVALID");
  } catch { throw new Phase7SecurityError("POOLER_CA_INVALID"); }
  return pem;
}
export function validatePhase7SessionPoolerDestination(value: unknown, trustedCaPem: unknown) {
  requireThat(typeof value === "string" && value.length > 0 && value.length < 8192,
    "DEV_POOLER_DESTINATION_REJECTED");
  let parsed: URL, password: string;
  try {
    const text = value as string;
    requireThat(!/[\s\\\x00-\x1f\x7f]/.test(text) && !/%(?![0-9a-f]{2})/i.test(text),
      "DEV_POOLER_DESTINATION_REJECTED");
    const rawAuthority = text.slice(text.indexOf("://") + 3).split("/")[0];
    requireThat((rawAuthority.match(/@/g) ?? []).length === 1, "DEV_POOLER_DESTINATION_REJECTED");
    parsed = new URL(text);
    password = decodeURIComponent(parsed.password);
  } catch { throw new Phase7SecurityError("DEV_POOLER_DESTINATION_REJECTED"); }
  requireThat(!(value as string).includes(PROD), "PRODUCTION_DATABASE_REJECTED");
  requireThat(["postgres:", "postgresql:"].includes(parsed.protocol)
    && parsed.hostname === PHASE7_DEV_SESSION_POOLER_HOST
    && parsed.port === "5432" && parsed.username === PHASE7_DEV_SESSION_POOLER_LOGIN
    && parsed.pathname === "/postgres" && !parsed.search && !parsed.hash
    && password.length > 0 && !/[\x00-\x1f\x7f]/.test(password),
    "DEV_POOLER_DESTINATION_REJECTED");
  const ca = validatePhase7TrustedPoolerCa(trustedCaPem);
  return {
    host: PHASE7_DEV_SESSION_POOLER_HOST, port: 5432, database: "postgres",
    user: PHASE7_DEV_SESSION_POOLER_LOGIN, password,
    ssl: { rejectUnauthorized: true, servername: PHASE7_DEV_SESSION_POOLER_HOST, ca },
    replication: "false", sslnegotiation: "postgres", client_encoding: "UTF8",
    application_name: "phase7_shadow_manual",
    options: "-c default_transaction_read_only=off -c timezone=UTC -c datestyle=ISO,YMD -c search_path=public",
  };
}
// Compatibility-only parser: old Phase 8 comparisons rely on these options.
// Do not use this function to open a real Phase 7 session.
export function validatePhase7Destination(value: unknown) {
  return validatePhase7DestinationForRole(value, "postgres");
}
// Both real PREVIEW and real SAVE require a dedicated, restricted login.
export function validatePhase7DedicatedDestination(value: unknown) {
  return validatePhase7DestinationForRole(value, PHASE7_DEDICATED_DEV_ROLE);
}
export const PHASE7_OFFLINE_DESTINATION = "postgresql://postgres:offline-mock-value@phase7-shadow.invalid:5432/postgres";
export function validatePhase7OfflineDestination(value: unknown) {
  requireThat(value === PHASE7_OFFLINE_DESTINATION, "OFFLINE_DESTINATION_REQUIRED");
  return {host: "phase7-shadow.invalid", port: 5432, database: "postgres", user: "postgres",
    options: "-c default_transaction_read_only=off -c timezone=UTC -c datestyle=ISO,YMD -c search_path=public",
    password: "offline-mock-value", ssl: {rejectUnauthorized: true, servername: "phase7-shadow.invalid"}};
}
function snapshotArguments(values: unknown): unknown[] {
  const ancestors = new Set<unknown>();
  function copy(value: unknown): unknown {
    if (value === null || ["string", "boolean", "undefined", "bigint"].includes(typeof value)
      || typeof value === "number" && Number.isFinite(value)) return value;
    requireThat(!types.isProxy(value) && Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
      && !Object.getOwnPropertyDescriptor(Array.prototype, "toPostgres")
      && !Object.getOwnPropertyDescriptor(Object.prototype, "toPostgres") && !ancestors.has(value), "INVALID_QUERY_ARGUMENTS");
    const array = value as unknown[];
    ancestors.add(array);
    const descriptors = Object.getOwnPropertyDescriptors(array);
    requireThat(Reflect.ownKeys(descriptors).length === array.length + 1, "INVALID_QUERY_ARGUMENTS");
    const result: unknown[] = [];
    for (let index = 0; index < array.length; index++) {
      const descriptor = descriptors[String(index)];
      requireThat(descriptor && "value" in descriptor, "INVALID_QUERY_ARGUMENTS");
      result.push(copy(descriptor.value));
    }
    ancestors.delete(array);
    return Object.freeze(result);
  }
  requireThat(Array.isArray(values), "INVALID_QUERY_ARGUMENTS");
  return copy(values) as unknown[];
}
type QueryResult = { rows: Record<string, unknown>[]; command?: string; rowCount?: number | null };
type ClientLike = {
  connect(): Promise<unknown>; end(): Promise<unknown>;
  query(config: { text: string; values: unknown[]; query_timeout: number }): Promise<QueryResult>;
  on(name: string, callback: (error: unknown) => void): unknown;
  connection?: { stream?: { destroy(): unknown; encrypted?: boolean; authorized?: boolean;
    authorizationError?: unknown; servername?: string; getPeerCertificate?(detailed: boolean): PeerCertificate } };
};
export function observePhase7Tls(client: ClientLike, expectedHost: string = HOST) {
  try { const socket = client.connection?.stream;
    return socket?.encrypted === true && socket.authorized === true && !socket.authorizationError
      && socket.servername === expectedHost
      && checkServerIdentity(expectedHost, socket.getPeerCertificate!(true)) === undefined;
  } catch { return false; }
}
const verified = new WeakMap<object, { destination: string; check: () => void }>();
export function assertPhase7Database(database: unknown, destination: string) {
  const proof = database && typeof database === "object" ? verified.get(database) : undefined;
  requireThat(proof?.destination === destination, "VERIFIED_DATABASE_REQUIRED"); proof!.check();
}
function emptyAudit() { return { commitAttempts: 0, commitsAcknowledged: 0, commitOutcomeUnknown: false,
  persistenceAttempted: false, partialPersistencePossible: false, cleanupFailed: false,
  rollbackComplete: false, lockCleanupComplete: true, clientClosed: false, databaseError: false, cancelled: false }; }
// Trusted factory/observer/clock injection is for offline tests. No default driver or env access.
export async function openPhase7Session(destination: string, mode: "PREVIEW" | "SAVE", {
  createClient, loadClient, observe = observePhase7Tls, now = () => performance.now(), signal,
  limits: overrides = {}, offlineTest = false,
  connectionMethod = "DIRECT_DEV", trustedCaPem,
}: { createClient?: (options: object) => ClientLike; loadClient?: () => Promise<(options: object) => ClientLike>;
  observe?: (client: ClientLike) => boolean; now?: () => number; signal?: AbortSignal;
  offlineTest?: boolean; limits?: Partial<typeof PHASE7_SECURITY_LIMITS>;
  connectionMethod?: Phase7ConnectionMethod; trustedCaPem?: string } = {}) {
  if (offlineTest) requireThat(typeof createClient === "function" && !loadClient
    && observe !== observePhase7Tls, "OFFLINE_DEPENDENCIES_REQUIRED");
  requireThat(typeof offlineTest === "boolean", "INVALID_OFFLINE_MODE");
  requireThat(connectionMethod === "DIRECT_DEV" || connectionMethod === "SESSION_POOLER_IPV4",
    "INVALID_CONNECTION_METHOD");
  requireThat(!offlineTest || (connectionMethod === "DIRECT_DEV" && trustedCaPem === undefined),
    "OFFLINE_DEPENDENCIES_REQUIRED");
  requireThat(connectionMethod === "SESSION_POOLER_IPV4" || trustedCaPem === undefined,
    "POOLER_CA_UNEXPECTED");
  const options = offlineTest ? validatePhase7OfflineDestination(destination)
    : connectionMethod === "DIRECT_DEV" ? validatePhase7DedicatedDestination(destination)
    : validatePhase7SessionPoolerDestination(destination, trustedCaPem);
  requireThat(mode === "PREVIEW" || mode === "SAVE", "INVALID_MODE");
  const limits = { ...PHASE7_SECURITY_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) requireThat(key in PHASE7_SECURITY_LIMITS
    && Number.isSafeInteger(value) && value > 0 && value <= PHASE7_SECURITY_LIMITS[key as keyof typeof limits], "INVALID_LIMITS");
  const deadline = now() + limits.applicationMs, audit = emptyAudit();
  let client: ClientLike | undefined, stopped = false, socketError = false, connected = false;
  const locks = new Map<string, string>(); // OFFLINE legacy fixtures only
  const capabilityLocks = new Map<string, { owner: string; secret: string }>();
  let transactionActive = false;
  const lockOperations = new Set<string>();
  const pending = new Set<Promise<unknown>>();
  let closePromise: Promise<ReturnType<typeof emptyAudit>> | undefined;
  const check = () => { requireThat(!stopped, "SESSION_STOPPED");
    requireThat(now() < deadline, "APPLICATION_TIMEOUT"); requireThat(!signal?.aborted, "CANCELLED");
    requireThat(!socketError, "DATABASE_FAILED"); };
  async function wait<T>(action: () => Promise<T>, end: number, code: string, active = true): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined, abort: (() => void) | undefined;
    const test = () => { if (active) check(); requireThat(now() < end, code); };
    try { test();
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Phase7SecurityError(active && now() >= deadline ? "APPLICATION_TIMEOUT" : code)), Math.max(1, Math.ceil(end - now())));
        if (active) { abort = () => reject(new Phase7SecurityError("CANCELLED")); signal?.addEventListener("abort", abort, { once: true }); }
      });
      const result = await Promise.race([Promise.resolve().then(() => { test(); return action(); }), timeout]);
      test(); return result;
    } finally { clearTimeout(timer); if (abort) signal?.removeEventListener("abort", abort); }
  }
  async function query(text: string, values: unknown[] = []): Promise<QueryResult> {
    try { values = snapshotArguments(values); }
    catch { throw new Phase7SecurityError("INVALID_QUERY_ARGUMENTS"); }
    check(); requireThat(typeof text === "string" && !text.includes(";"), "INVALID_QUERY");
    requireThat(Array.isArray(values), "INVALID_QUERY_ARGUMENTS");
    const legacy = [PHASE7_ACQUIRE_LOCK_SQL, PHASE7_RELEASE_LOCK_SQL, PHASE7_FENCE_LOCK_SQL].includes(text);
    // DEV must never fall back to owner-ID-only DML, even when SQL remains registered for OFFLINE tests.
    if (legacy && !offlineTest) throw new Phase7SecurityError("LEGACY_PHASE7_LOCK_DISABLED");
    const registration = phase7SqlRegistration(text);
    if (mode === "PREVIEW") requireThat(PHASE7_READ_SQL.includes(text) || text === PHASE7_CAP_ROLE_READY_SQL
      || text === PHASE7_CAP_ACQUIRE_SQL || text === PHASE7_CAP_RELEASE_SQL
      || offlineTest && (text === PHASE7_ACQUIRE_LOCK_SQL || text === PHASE7_RELEASE_LOCK_SQL), "PREVIEW_WRITE_REJECTED");
    requireThat(registration, "UNREGISTERED_WRITE");
    requireThat(registration!.validate(values),
      ["ACQUIRE_LOCK", "RELEASE_LOCK", "CAP_ACQUIRE", "CAP_RELEASE", "CAP_FENCE", "CAP_BIND"].includes(registration!.kind)
      ? "INVALID_LOCK" : "INVALID_QUERY_ARGUMENTS");
    const kind = registration!.kind;
    const verb = registration!.command;
    if (kind === "RELEASE_LOCK" || kind === "LOCK_FENCE")
      requireThat(locks.get(values[0] as string) === values[1], "INVALID_LOCK");
    if (kind === "ACQUIRE_LOCK") {
      requireThat(!locks.has(String(values[0])) && !lockOperations.has(String(values[0])), "LOCK_OPERATION_CONFLICT");
      locks.set(String(values[0]), values[1] as string);
    }
    if (kind === "CAP_RELEASE" || kind === "CAP_FENCE") {
      const owned = capabilityLocks.get(values[0] as string);
      requireThat(owned?.owner === values[1] && owned?.secret === values[2], "INVALID_PHASE7_CAPABILITY");
    }
    if (kind === "CAP_BIND") {
      requireThat(transactionActive && [...capabilityLocks.values()].some(lock => lock.secret === values[0]),
        "INVALID_PHASE7_CAPABILITY");
    }
    if (kind === "CAP_ACQUIRE") {
      requireThat(!capabilityLocks.has(String(values[0])) && !lockOperations.has(String(values[0])), "LOCK_OPERATION_CONFLICT");
      // Record uncertain ownership before sending to PostgreSQL, for token-scoped cleanup.
      capabilityLocks.set(String(values[0]), { owner: String(values[1]), secret: String(values[2]) });
    }
    const lockOperation = [PHASE7_ACQUIRE_LOCK_SQL, PHASE7_RELEASE_LOCK_SQL,
      PHASE7_CAP_ACQUIRE_SQL, PHASE7_CAP_RELEASE_SQL].includes(text);
    const key = lockOperation ? String(values[0]) : "";
    if (lockOperation) {
      requireThat(!lockOperations.has(key), "LOCK_OPERATION_CONFLICT");
      lockOperations.add(key);
    }
    if (verb === "COMMIT") { audit.commitAttempts++; audit.commitOutcomeUnknown = true; }
    if (kind === "PERSISTENCE") audit.persistenceAttempted = true;
    const end = Math.min(deadline, now() + limits.statementMs);
    let result: QueryResult;
    try { result = await wait(() => {
      const operation = Promise.resolve(client!.query({ text, values, query_timeout: Math.max(1, Math.ceil(end - now())) }));
      pending.add(operation);
      operation.then(() => pending.delete(operation), () => pending.delete(operation));
      return operation;
    }, end, "STATEMENT_TIMEOUT"); }
    catch (error) { stopped = true; throw error instanceof Phase7SecurityError ? error : new Phase7SecurityError("DATABASE_FAILED"); }
    try {
      requireThat(result && typeof result === "object", lockOperation ? "LOCK_ACK_FAILED" : "DATABASE_FAILED");
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(verb) && result.command !== verb) {
        stopped = true; throw new Phase7SecurityError(verb === "COMMIT" ? "COMMIT_ACK_FAILED" : "TRANSACTION_ACK_FAILED");
      }
      if (verb === "COMMIT") {
        audit.commitsAcknowledged++; audit.commitOutcomeUnknown = false; }
      if (verb === "BEGIN") transactionActive = true;
      if (verb === "COMMIT" || verb === "ROLLBACK") transactionActive = false;
      if (text === PHASE7_FENCE_LOCK_SQL) requireThat(result.command === "SELECT" && Array.isArray(result.rows), "LOCK_ACK_FAILED");
      if (kind === "CAP_FENCE" || kind === "CAP_BIND") {
        requireThat(result.command === "SELECT" && Array.isArray(result.rows) && result.rows.length === 1
          && result.rows[0]?.[kind === "CAP_FENCE" ? "fenced" : "bound"] === true,
          kind === "CAP_FENCE" ? "PHASE7_LEASE_LOST" : "CAPABILITY_BIND_FAILED");
      }
      if (kind === "CAP_ACQUIRE" || kind === "CAP_RELEASE") {
        requireThat(result.command === "SELECT" && Array.isArray(result.rows) && result.rows.length === 1
          && typeof result.rows[0]?.[kind === "CAP_ACQUIRE" ? "acquired" : "released"] === "boolean", "LOCK_ACK_FAILED");
        if (kind === "CAP_ACQUIRE" && result.rows[0]?.acquired === false) capabilityLocks.delete(key);
        if (kind === "CAP_RELEASE" && result.rows[0]?.released === true) capabilityLocks.delete(key);
      }
      if (kind === "ACQUIRE_LOCK") {
        requireThat(result.command === "INSERT" && Array.isArray(result.rows) && result.rows.length <= 1
          && (result.rows.length === 0 || result.rows[0]?.lock_key === key)
          && (result.rowCount === result.rows.length), "LOCK_ACK_FAILED");
        if (!result.rows.length) locks.delete(key);
      }
      if (kind === "RELEASE_LOCK") {
        requireThat(result.command === "DELETE" && Array.isArray(result.rows) && result.rows.length === 0
          && (result.rowCount === 0 || result.rowCount === 1), "LOCK_ACK_FAILED"); locks.delete(key);
      }
      return result;
    } catch (error) { stopped = true; throw error instanceof Phase7SecurityError ? error : new Phase7SecurityError("DATABASE_FAILED"); }
    finally { if (lockOperation) lockOperations.delete(key); }
  }
  const database = Object.freeze({ query, async connect() { check(); return { query, release() {} }; } });
  function close() {
    if (!closePromise) closePromise = finishClose();
    return closePromise;
  }
  async function finishClose() {
    stopped = true; verified.delete(database);
    const end = Math.min(now(), deadline) + limits.cleanupMs;
    async function cleanup(text: string, values: unknown[], command: string) {
      try { values = snapshotArguments(values);
        const result = await wait(() => client!.query({ text, values, query_timeout: Math.max(1, Math.ceil(end - now())) }), end, "CLEANUP_TIMEOUT", false);
        requireThat(result.command === command, "CLEANUP_ACK_FAILED");
        if (command === "DELETE") requireThat(Array.isArray(result.rows) && result.rows.length === 0
          && (result.rowCount === 0 || result.rowCount === 1), "CLEANUP_ACK_FAILED"); return true;
      } catch { audit.cleanupFailed = true; return false; }
    }
    if (client) {
      if (connected) {
        try { await wait(() => Promise.allSettled([...pending]), end, "CLEANUP_TIMEOUT", false); }
        catch { audit.cleanupFailed = true; audit.lockCleanupComplete = locks.size === 0 && capabilityLocks.size === 0;
          try { client.connection?.stream?.destroy(); } catch { /* sanitized */ }
          connected = false;
        }
      }
      if (connected) {
        audit.rollbackComplete = await cleanup(PHASE7_ROLLBACK_SQL, [], "ROLLBACK");
        // Ownership-scoped deletion cannot remove another run's lock.
        for (const [key, owner] of locks) if (!await cleanup(PHASE7_RELEASE_LOCK_SQL, [key, owner], "DELETE")) audit.lockCleanupComplete = false;
        // Release capability-owned locks using the in-memory token, never owner-ID-only DML.
        for (const [key, entry] of capabilityLocks) {
          try {
            const values = snapshotArguments([key, entry.owner, entry.secret]);
            const released = await wait(() => client!.query({ text: PHASE7_CAP_RELEASE_SQL,
              values, query_timeout: Math.max(1, Math.ceil(end - now())) }), end, "CLEANUP_TIMEOUT", false);
            if (released.command !== "SELECT" || released.rows.length !== 1 || released.rows[0]?.released !== true)
              audit.lockCleanupComplete = false;
          } catch { audit.lockCleanupComplete = false; audit.cleanupFailed = true; }
        }
      }
      try { const ending = Promise.resolve(client.end()); ending.catch(() => {});
        await wait(() => ending, end, "CLIENT_CLOSE_FAILED", false); audit.clientClosed = true;
      } catch { audit.cleanupFailed = true; }
      if (audit.cleanupFailed) { try { client.connection?.stream?.destroy(); } catch { /* sanitized */ } }
    }
    audit.databaseError = socketError;
    audit.cancelled = signal?.aborted === true;
    audit.partialPersistencePossible = audit.persistenceAttempted || audit.commitAttempts > 0;
    return { ...audit };
  }
  try {
    check(); if (loadClient) createClient = await wait(loadClient, deadline, "APPLICATION_TIMEOUT");
    requireThat(typeof createClient === "function", "CLIENT_FACTORY_REQUIRED");
    client = createClient!({ ...options, connectionTimeoutMillis: limits.connectionMs,
      query_timeout: limits.statementMs, statement_timeout: limits.statementMs, lock_timeout: limits.statementMs,
      idle_in_transaction_session_timeout: limits.applicationMs });
    client.on("error", () => { socketError = true; });
    await wait(() => client!.connect(), Math.min(deadline, now() + limits.connectionMs), "CONNECTION_TIMEOUT"); connected = true;
    requireThat((observe === observePhase7Tls
      ? observePhase7Tls(client, options.ssl.servername) : observe(client)) === true,
      "TLS_VERIFICATION_FAILED");
    const identity = await query(PHASE7_IDENTITY_SQL);
    requireThat(identity.command === "SELECT" && identity.rows.length === 1 && identity.rows[0]?.database_name === "postgres"
      && identity.rows[0]?.current_role === (offlineTest ? options.user : PHASE7_DEDICATED_DEV_ROLE)
      && identity.rows[0]?.session_role === (offlineTest ? options.user : PHASE7_DEDICATED_DEV_ROLE),
      "IDENTITY_MISMATCH");
    if (!offlineTest) {
      // DB-side proof: restrict even a matching role name that has acquired privileged grants.
      const proof = await query(PHASE7_ROLE_PROOF_SQL);
      const row = proof.rows[0];
      requireThat(proof.command === "SELECT" && proof.rows.length === 1 && row?.rolcanlogin === true
        && row?.rolsuper === false && row?.rolbypassrls === false
        && row?.rolcreatedb === false && row?.rolcreaterole === false && row?.rolreplication === false
        && row?.phase7_table_count === 4 && row?.phase7_rls_count === 4
        && row?.phase7_owner_memberships === 0 && row?.broad_data_memberships === 0,
        "ROLE_SECURITY_UNCONFIRMED");
    }
    if (!offlineTest) {
      const readiness = await query(PHASE7_CAP_ROLE_READY_SQL);
      const row = readiness.rows[0];
      requireThat(readiness.command === "SELECT" && readiness.rows.length === 1
        && row?.capability_functions === 4 && row?.restrictive_insert_policies === 3
        && row?.direct_lock_insert === false && row?.direct_lock_update === false
        && row?.direct_lock_delete === false && row?.cap_schema_usage === true,
        "CAPABILITY_SCHEMA_UNCONFIRMED");
    }
    verified.set(database, { destination, check });
  } catch (error) { const report = await close(); const failure = error instanceof Phase7SecurityError ? error : new Phase7SecurityError("DATABASE_FAILED");
    failure.audit = report; throw failure; }
  return { database, close, audit, check,
    async run<T>(action: () => Promise<T>) { return wait(action, deadline, "APPLICATION_TIMEOUT"); } };
}
