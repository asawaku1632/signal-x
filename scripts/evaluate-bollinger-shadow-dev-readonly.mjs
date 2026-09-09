import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { canonicalPhase8Json, evaluateBollingerShadow, PHASE_8_EVALUATION_VERSION,
  PHASE_8_COHORT_DEFINITION_VERSION } from "../app/lib/technicalObservation/bollingerShadowEvaluation.ts";
import { resolveTseTradingDatesAfter, isTseTargetDateReady,
  TSE_MARKET_CALENDAR_VERSION } from "../app/lib/technicalObservation/tseMarketCalendar.ts";

// Usage (future separately authorized execution only):
// node scripts/evaluate-bollinger-shadow-dev-readonly.mjs --confirm-dev <DEV_REF>
//   --from YYYY-MM-DD --through YYYY-MM-DD --source-cutoff YYYY-MM-DDTHH:mm:ss.sssZ
// Connection setting: TECHNICAL_BB_PHASE8_DEV_DATABASE_URL. Never put it in argv.
// All cutoff-visible snapshots in the date range must match daily Phase 7 scope;
// mixed scope aborts, with no silent filtering. ID-sorted validation is fail-closed.
// Manual only. Operational prerequisite: an existing direct DEV connection on
// port 5432, database postgres, user postgres, with verified TLS and SELECT access.
// This policy does not assert that the hostname is reachable. No pooler fallback.
export const DEV_REF = "jdtqwryiyxeuoraecorw";
const PROD_REF = "paygtakajhvatwejygda";
const HOST = `db.${DEV_REF}.supabase.co`;
const CALENDAR = "JPX_MARKET_HOLIDAYS_2026_2027_2026-02-06";
const DETECTOR = "BB_OBSERVATION_V1";
const RESULT = "BB_OBSERVATION_RESULT_V1";
export const LIMITS = Object.freeze({ pageSize: 250, snapshots: 10_000,
  events: 10_000, results: 30_000, bytes: 16 * 1024 * 1024,
  timeoutMs: 60_000, statementTimeoutMs: 15_000, cleanupTimeoutMs: 2_000 });
const LIMITATIONS = Object.freeze([
  "created_at is not a commit timestamp; no immutable historical row versions exist.",
  "One transaction provides a consistent visible dataset, not unconditional historical replay.",
  "Calendar version identifies code validation, not historical producer attestation.",
  "Result rows have no independent provider or calendar provenance; candles are not revalidated.",
]);
class Rejected extends Error { constructor(code) { super(code); this.code = code; } }
function requireThat(condition, code) { if (!condition) throw new Rejected(code); }
function dateOnly(value) {
  requireThat(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value, "INVALID_DATE");
  return value;
}
function cutoff(value) {
  requireThat(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, "INVALID_CUTOFF");
  return value;
}
export function validateConfiguration(input) {
  requireThat(input && input.confirmDev === DEV_REF, "DEV_CONFIRMATION_REQUIRED");
  const from = dateOnly(input.from), through = dateOnly(input.through);
  requireThat(from <= through && (Date.parse(through) - Date.parse(from)) / 86400000 < 366, "INVALID_DATE_RANGE");
  const sourceCutoff = cutoff(input.sourceCutoff);
  requireThat(through <= sourceCutoff.slice(0, 10), "RANGE_AFTER_CUTOFF");
  requireThat(TSE_MARKET_CALENDAR_VERSION === CALENDAR, "CALENDAR_VERSION_MISMATCH");
  return Object.freeze({ from, through, sourceCutoff });
}
export function validateDestination(value) {
  requireThat(typeof value === "string" && value.length < 8192, "INVALID_DESTINATION");
  let parsed, username, password;
  try {
    requireThat(!/[\s\\]/.test(value) && !/%(?![0-9a-f]{2})/i.test(value), "INVALID_DESTINATION");
    parsed = new URL(value);
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch { throw new Rejected("INVALID_DESTINATION"); }
  requireThat(!`${parsed.hostname}:${username}:${parsed.pathname}`.includes(PROD_REF), "PRODUCTION_REJECTED");
  requireThat(["postgres:", "postgresql:"].includes(parsed.protocol), "INVALID_PROTOCOL");
  requireThat(parsed.hostname === HOST && username === "postgres", "DEV_IDENTITY_UNCONFIRMED");
  requireThat(parsed.pathname === "/postgres" && (!parsed.port || parsed.port === "5432")
    && !parsed.search && !parsed.hash && password.length > 0 && !/[\x00-\x1f\x7f]/.test(password), "UNSAFE_CONNECTION_OPTIONS");
  // Explicit destination/TLS options: no connectionString or generic URL fallback.
  return { host: HOST, port: 5432, database: "postgres", user: "postgres", password,
    ssl: { rejectUnauthorized: true, servername: HOST }, connectionTimeoutMillis: 5_000,
    query_timeout: LIMITS.statementTimeoutMs, statement_timeout: LIMITS.statementTimeoutMs,
    idle_in_transaction_session_timeout: LIMITS.timeoutMs,
    application_name: "phase8_readonly", replication: "false", sslnegotiation: "postgres", client_encoding: "UTF8",
    options: "-c default_transaction_read_only=on -c timezone=UTC -c datestyle=ISO,YMD" };
}
export function parseArguments(args) {
  const names = { "--confirm-dev": "confirmDev", "--from": "from", "--through": "through", "--source-cutoff": "sourceCutoff" };
  const input = {};
  for (let i = 0; i < args.length; i += 2) {
    requireThat(Object.hasOwn(names, args[i]), "INVALID_ARGUMENTS");
    const key = names[args[i]];
    requireThat(key && !(key in input) && typeof args[i + 1] === "string", "INVALID_ARGUMENTS");
    input[key] = args[i + 1];
  }
  validateConfiguration(input);
  return input;
}

// SQL is private and closed: callers select an operation, never supply SQL.
// Date/timestamp text casts prevent pg's local-time DATE conversion. Timestamp
// comparisons remain PostgreSQL comparisons (including microsecond precision).
const SQL = Object.freeze({
  begin: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  guard: `SELECT current_setting('transaction_read_only') AS read_only,
    current_setting('transaction_isolation') AS isolation,
    (transaction_timestamp() >= $1::timestamptz) AS cutoff_allowed`,
  rollback: "ROLLBACK",
  snapshots: `SELECT s.id::text, left(s.code,33) AS code, s.observation_date::text, left(s.timeframe,8) AS timeframe,
    left(s.close::text,129) AS close, left(s.detector_version,128) AS detector_version,
    left(s.provider,128) AS provider, left(s.timezone,128) AS timezone,
    s.bar_start_at::text, s.bar_end_at::text, s.created_at::text,
    (s.metadata->'shadowOnly' = 'true'::jsonb) AS shadow_only, CASE WHEN jsonb_typeof(s.metadata->'phase')='string' THEN left(s.metadata->>'phase',32) END AS phase,
    CASE WHEN jsonb_typeof(s.metadata->'executionSource')='string' THEN left(s.metadata->>'executionSource',128) END AS execution_source,
    (s.bar_end_at <= $3::timestamptz) AS bar_ready
    FROM public.technical_bb_observation_snapshots s
    WHERE s.observation_date BETWEEN $1::date AND $2::date
      AND s.created_at <= $3::timestamptz AND ($4::bigint IS NULL OR s.id > $4::bigint)
    ORDER BY s.id LIMIT $5`,
  events: `SELECT e.id::text, e.snapshot_id::text, left(e.side,32) AS side, e.sigma_level, left(e.event_type,32) AS event_type, e.created_at::text
    FROM public.technical_bb_observation_events e
    WHERE e.snapshot_id = ANY($1::bigint[]) AND e.created_at <= $2::timestamptz AND ($3::bigint IS NULL OR e.id > $3::bigint)
    ORDER BY e.id LIMIT $4`,
  results: `SELECT r.id::text, r.event_id::text, r.horizon, left(r.horizon_unit,32) AS horizon_unit,
    left(r.entry_price::text,129) AS entry_price, left(r.future_close::text,129) AS future_close, left(r.return_percent::text,129) AS return_percent,
    left(r.max_rise_percent::text,129) AS max_rise_percent, left(r.max_drawdown_percent::text,129) AS max_drawdown_percent,
    r.max_rise_trade_date::text, r.max_drawdown_trade_date::text,
    r.evaluated_trade_date::text, r.evaluated_at::text, r.created_at::text,
    r.window_candle_count, left(r.result_quality,32) AS result_quality, left(r.result_version,128) AS result_version,
    (r.evaluated_at <= $2::timestamptz) AS evaluation_visible
    FROM public.technical_bb_observation_results r
    WHERE r.event_id = ANY($1::bigint[]) AND r.created_at <= $2::timestamptz
      AND r.evaluated_at <= $2::timestamptz AND ($3::bigint IS NULL OR r.id > $3::bigint)
    ORDER BY r.id LIMIT $4`,
  relationships: `SELECT EXISTS (
    SELECT 1 FROM public.technical_bb_observation_events e
    LEFT JOIN public.technical_bb_observation_snapshots s ON s.id=e.snapshot_id
    WHERE e.created_at <= $3::timestamptz AND (s.id IS NULL OR
      (s.observation_date BETWEEN $1::date AND $2::date AND s.created_at > $3::timestamptz))
    UNION ALL
    SELECT 1 FROM public.technical_bb_observation_results r
    LEFT JOIN public.technical_bb_observation_events e ON e.id=r.event_id
    LEFT JOIN public.technical_bb_observation_snapshots s ON s.id=e.snapshot_id
    WHERE r.created_at <= $3::timestamptz AND (e.id IS NULL OR
      (s.observation_date BETWEEN $1::date AND $2::date AND
        (e.created_at > $3::timestamptz OR s.created_at > $3::timestamptz OR r.evaluated_at > $3::timestamptz)))
    ) AS invalid`,
});
function number(value, integer = false) {
  requireThat((typeof value === "number" || (typeof value === "string"
    && value.length <= 128 && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)))
    && Number.isFinite(Number(value)), "INVALID_NUMBER");
  const n = Number(value);
  requireThat(n !== 0 || !/[1-9]/.test(String(value).split(/[eE]/)[0]), "NUMERIC_UNDERFLOW");
  requireThat(!integer || Number.isSafeInteger(n), "UNSAFE_INTEGER");
  return n;
}
function id(value) { const n = number(value, true); requireThat(n > 0, "INVALID_ID"); return n; }
function positive(value) { const n = number(value); requireThat(n > 0, "INVALID_PRICE"); return n; }
// Compare persisted decimal prices without losing differences through IEEE rounding.
function decimalKey(value) {
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const digits = (whole + fraction).replace(/^0+/, "");
  const trimmed = digits.replace(/0+$/, "");
  return trimmed + ":" + (Number(exponent) - fraction.length + digits.length - trimmed.length);
}
function timestamp(value) {
  requireThat(typeof value === "string" && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::\d{2})?)$/.test(value), "INVALID_TIMESTAMP");
  dateOnly(value.slice(0, 10));
  requireThat(Number(value.slice(11,13)) < 24 && Number(value.slice(14,16)) < 60 && Number(value.slice(17,19)) < 60, "INVALID_TIMESTAMP");
  const normalized = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const match = normalized.match(/\.(\d+)(?=Z|[+-])/);
  const millis = Date.parse(normalized);
  requireThat(Number.isFinite(millis), "INVALID_TIMESTAMP");
  // Preserve sub-millisecond precision for row cutoff checks.
  return BigInt(millis) * 1000n + BigInt((match?.[1] ?? "").padEnd(6, "0").slice(3, 6));
}
function unique(set, key, code) { requireThat(!set.has(key), code); set.add(key); }
function validateRows(rows, scope) {
  const cut = timestamp(scope.sourceCutoff), snaps = new Map(), events = new Map();
  const natural = new Set(), logical = new Set(), resultIds = new Set(), resultKeys = new Set();
  const dates = new Map();
  const visible = (r) => requireThat(timestamp(r.created_at) <= cut, "CUTOFF_INCONSISTENCY");
  for (const r of rows.snapshots) {
    visible(r);
    const key = id(r.id), observationDate = dateOnly(r.observation_date);
    requireThat(observationDate >= scope.from && observationDate <= scope.through, "OUT_OF_SCOPE");
    requireThat(r.timeframe === "1D" && r.provider === "YAHOO_CHART" && r.timezone === "Asia/Tokyo"
      && r.shadow_only === true && r.phase === "7" && r.execution_source === "PHASE_7_SHADOW_AUTOMATION", "INVALID_PROVENANCE");
    requireThat(r.detector_version === DETECTOR, "DETECTOR_VERSION_MISMATCH");
    requireThat(typeof r.code === "string" && r.code.length > 0 && r.code.length <= 32 && r.code.trim() === r.code, "INVALID_CODE");
    requireThat(r.bar_ready === true && timestamp(r.bar_start_at) < timestamp(r.bar_end_at)
      && timestamp(r.bar_end_at) <= cut, "INVALID_BAR_WINDOW");
    const tokyoDate = (value) => new Date(Number(timestamp(value) / 1000n) + 9 * 3600000).toISOString().slice(0, 10);
    requireThat(tokyoDate(r.bar_start_at) === observationDate && tokyoDate(r.bar_end_at) === observationDate, "BAR_DATE_MISMATCH");
    requireThat(!snaps.has(key), "DUPLICATE_SNAPSHOT");
    unique(natural, canonicalPhase8Json([r.code, r.timeframe, timestamp(r.bar_end_at).toString(), r.detector_version]), "DUPLICATE_SNAPSHOT_KEY");
    let tradingDates;
    try { tradingDates = resolveTseTradingDatesAfter(observationDate, 5); }
    catch { throw new Rejected("CALENDAR_UNAVAILABLE"); }
    dates.set(key, tradingDates);
    snaps.set(key, { code: r.code, observationDate, close: positive(r.close), closeKey: decimalKey(r.close), detectorVersion: r.detector_version });
  }
  for (const r of rows.events) {
    visible(r);
    const eventId = id(r.id), snapshotId = id(r.snapshot_id), s = snaps.get(snapshotId);
    requireThat(s, "MISSING_SNAPSHOT");
    requireThat(!events.has(eventId), "DUPLICATE_EVENT");
    const sigmaLevel = number(r.sigma_level, true);
    requireThat(["LOWER", "UPPER"].includes(r.side) && [2, 3].includes(sigmaLevel)
      && ["TOUCH", "CROSS", "CONTINUATION", "RETURN_INSIDE"].includes(r.event_type), "INVALID_EVENT");
    unique(logical, canonicalPhase8Json([snapshotId, r.side, sigmaLevel, r.event_type]), "DUPLICATE_LOGICAL_EVENT");
    events.set(eventId, { eventId, snapshotId, code: s.code, observationDate: s.observationDate,
      detectorVersion: s.detectorVersion, side: r.side, sigmaLevel, eventType: r.event_type, results: [] });
  }
  for (const r of rows.results) {
    visible(r);
    unique(resultIds, id(r.id), "DUPLICATE_RESULT");
    const e = events.get(id(r.event_id));
    requireThat(e, "MISSING_EVENT");
    const horizon = number(r.horizon, true);
    requireThat([1, 3, 5].includes(horizon) && r.horizon_unit === "TRADING_DAY"
      && r.result_quality === "COMPLETE" && number(r.window_candle_count, true) === horizon, "INVALID_RESULT_LIFECYCLE");
    requireThat(r.result_version === RESULT, "RESULT_VERSION_MISMATCH");
    unique(resultKeys, `${e.eventId}:${horizon}`, "DUPLICATE_RESULT_HORIZON");
    requireThat(r.evaluation_visible === true && timestamp(r.evaluated_at) <= cut, "CUTOFF_INCONSISTENCY");
    positive(r.entry_price);
    requireThat(decimalKey(r.entry_price) === snaps.get(e.snapshotId).closeKey, "PRICE_MISMATCH");
    positive(r.future_close);
    const window = dates.get(e.snapshotId).slice(0, horizon), expectedTradeDate = window[horizon - 1];
    requireThat(dateOnly(r.evaluated_trade_date) === expectedTradeDate
      && isTseTargetDateReady(expectedTradeDate, new Date(scope.sourceCutoff))
      && window.includes(dateOnly(r.max_rise_trade_date)) && window.includes(dateOnly(r.max_drawdown_trade_date)), "RESULT_CALENDAR_MISMATCH");
    e.results.push({ horizon, returnPercent: number(r.return_percent), maxRisePercent: number(r.max_rise_percent),
      maxDrawdownPercent: number(r.max_drawdown_percent), expectedTradeDate, evaluatedTradeDate: r.evaluated_trade_date,
      resultVersion: r.result_version, calendarVersion: CALENDAR });
  }
  const lifecycle = { notYetDue: { h1: 0, h3: 0, h5: 0 }, dueButAbsent: { h1: 0, h3: 0, h5: 0 } };
  const ordered = [...events.values()].sort((a, b) => a.eventId - b.eventId);
  for (const e of ordered) {
    e.results.sort((a, b) => a.horizon - b.horizon);
    for (const h of [1, 3, 5]) if (!e.results.some((r) => r.horizon === h)) {
      const due = isTseTargetDateReady(dates.get(e.snapshotId)[h - 1], new Date(scope.sourceCutoff));
      lifecycle[due ? "dueButAbsent" : "notYetDue"][`h${h}`] += 1;
    }
  }
  return { events: ordered, lifecycle };
}

function checkDeadline(deadline, signal, now) {
  // Expiration wins if deadline and external cancellation are both observable.
  requireThat(now() < deadline, "TIMEOUT");
  requireThat(!signal?.aborted, "CANCELLED");
}
async function bounded(start, deadline, signal, now) {
  let timer, abort;
  checkDeadline(deadline, signal, now);
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Rejected("TIMEOUT")), Math.max(1, Math.ceil(deadline - now())));
      abort = () => reject(new Rejected(now() >= deadline ? "TIMEOUT" : "CANCELLED"));
      signal?.addEventListener("abort", abort, { once: true });
    });
    const result = await Promise.race([Promise.resolve().then(() => {
      checkDeadline(deadline, signal, now);
      return start();
    }), timeout]);
    checkDeadline(deadline, signal, now);
    return result;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}

// Dependency injection is mandatory here. Only the manual CLI supplies pg.
export async function evaluateDevReadonly(input, { createClient, limits: overrides = {}, signal, now = () => performance.now() } = {}) {
  const startedAt = now();
  let client, output, cleanupFailed = false;
  const limits = { ...LIMITS, ...overrides };
  const deadline = startedAt + limits.timeoutMs;
  try {
    for (const [key, value] of Object.entries(limits)) requireThat(key in LIMITS
      && Number.isSafeInteger(value) && value > 0 && value <= LIMITS[key], "INVALID_LIMITS");
    const scope = validateConfiguration(input), connection = validateDestination(input.databaseUrl);
    requireThat(typeof createClient === "function", "CLIENT_FACTORY_REQUIRED");
    checkDeadline(deadline, signal, now);
    const remaining = Math.max(1, Math.ceil(deadline - now()));
    connection.connectionTimeoutMillis = Math.min(connection.connectionTimeoutMillis, remaining);
    connection.query_timeout = Math.min(limits.statementTimeoutMs, remaining);
    connection.statement_timeout = Math.min(limits.statementTimeoutMs, remaining);
    connection.idle_in_transaction_session_timeout = Math.min(limits.timeoutMs, remaining);
    client = createClient(connection);
    await bounded(() => client.connect(), deadline, signal, now);
    const query = async (operation, parameters = []) => {
      requireThat(Object.hasOwn(SQL, operation), "UNREGISTERED_QUERY");
      checkDeadline(deadline, signal, now);
      const queryDeadline = Math.min(deadline, now() + limits.statementTimeoutMs);
      return bounded(() => client.query({ text: SQL[operation], values: parameters,
        query_timeout: Math.max(1, Math.ceil(queryDeadline - now())) }), queryDeadline, signal, now);
    };
    await query("begin");
    const guard = (await query("guard", [scope.sourceCutoff])).rows;
    requireThat(guard?.length === 1 && guard[0].read_only === "on", "READ_ONLY_GUARD_FAILED");
    requireThat(guard[0].isolation === "repeatable read", "ISOLATION_GUARD_FAILED");
    requireThat(guard[0].cutoff_allowed === true, "FUTURE_CUTOFF");
    const relationships = (await query("relationships", [scope.from, scope.through, scope.sourceCutoff])).rows;
    requireThat(relationships?.length === 1 && relationships[0].invalid === false, "PARENT_CUTOFF_INCONSISTENCY");
    const rows = { snapshots: [], events: [], results: [] };
    // Exact byte length of the canonical digest dataset: fixed object/array
    // framing once, then each canonical row and inter-row comma once.
    let bytes = Buffer.byteLength(canonicalPhase8Json(rows));
    requireThat(bytes <= limits.bytes, "BYTE_LIMIT_EXCEEDED");
    async function pages(kind, prefix) {
      // NULL means no lower bound, exposing the complete PostgreSQL BIGINT
      // domain on the first page. id() rejects nonpositive IDs before mapping.
      let cursor = null;
      for (;;) {
        const batch = (await query(kind, [...prefix, cursor === null ? null : String(cursor), limits.pageSize])).rows;
        requireThat(Array.isArray(batch) && batch.length <= limits.pageSize, "INVALID_PAGE");
        requireThat(rows[kind].length + batch.length <= limits[kind], "ROW_LIMIT_EXCEEDED");
        for (const row of batch) {
          const next = id(row.id);
          requireThat(cursor === null || next > cursor, "NON_MONOTONIC_PAGE");
          bytes += Buffer.byteLength(canonicalPhase8Json(row)) + (rows[kind].length > 0 ? 1 : 0);
          requireThat(bytes <= limits.bytes, "BYTE_LIMIT_EXCEEDED");
          cursor = next;
          rows[kind].push(row);
        }
        if (batch.length < limits.pageSize) break;
      }
    }
    await pages("snapshots", [scope.from, scope.through, scope.sourceCutoff]);
    for (let start = 0; start < rows.snapshots.length; start += limits.pageSize)
      await pages("events", [rows.snapshots.slice(start, start + limits.pageSize).map((r) => String(id(r.id))), scope.sourceCutoff]);
    for (let start = 0; start < rows.events.length; start += limits.pageSize)
      await pages("results", [rows.events.slice(start, start + limits.pageSize).map((r) => String(id(r.id))), scope.sourceCutoff]);
    // Stable adapter validation order: snapshots, events, results; ascending IDs.
    // This is separate from, and does not alter, frozen evaluator precedence.
    for (const values of Object.values(rows)) values.sort((a, b) => id(a.id) - id(b.id));
    const mapped = validateRows(rows, scope);
    const digest = createHash("sha256").update(canonicalPhase8Json(rows)).digest("hex");
    checkDeadline(deadline, signal, now);
    output = { scope: { ...scope, timeframe: "1D", phase: "7", provider: "YAHOO_CHART", devProjectRef: DEV_REF },
      calendarVersionOrigin: "CODE_VALIDATION", limitations: LIMITATIONS, sourceBytes: bytes, sourceDigest: `sha256:${digest}`,
      counts: { snapshots: rows.snapshots.length, events: rows.events.length, results: rows.results.length },
      lifecycle: mapped.lifecycle,
      input: { sourceCutoff: scope.sourceCutoff, evaluationVersion: PHASE_8_EVALUATION_VERSION,
        cohortDefinitionVersion: PHASE_8_COHORT_DEFINITION_VERSION, detectorVersion: DETECTOR,
        resultVersion: RESULT, calendarVersion: CALENDAR, readOnly: true, events: mapped.events } };
  } catch (error) {
    output = { status: "ADAPTER_FAILED", errorCode: error instanceof Rejected ? error.code : "ACQUISITION_FAILED" };
  } finally {
    if (client) {
      // One shared grace window permits only rollback and transport shutdown.
      const cleanupDeadline = Math.min(now(), deadline) + limits.cleanupTimeoutMs;
      try { await bounded(() => client.query({ text: SQL.rollback, values: [],
        query_timeout: Math.max(1, Math.ceil(cleanupDeadline - now())) }), cleanupDeadline, undefined, now); }
      catch { cleanupFailed = true; }
      // Always attempt end, even when rollback exhausted the grace window.
      // Observe late rejection; force pg transport shutdown on cleanup failure.
      try {
        const ending = Promise.resolve(client.end());
        ending.catch(() => {});
        await bounded(() => ending, cleanupDeadline, undefined, now);
      } catch { cleanupFailed = true; }
      if (cleanupFailed) {
        try { client.connection?.stream?.destroy(); } catch { /* sanitized below */ }
      }
    }
  }
  if (cleanupFailed) return { status: "ADAPTER_FAILED", errorCode: "CLEANUP_FAILED" };
  if (output.status === "ADAPTER_FAILED") return output;
  const { input: evaluationInput, ...report } = output;
  try {
    checkDeadline(deadline, signal, now);
    const evaluation = evaluateBollingerShadow(evaluationInput);
    checkDeadline(deadline, signal, now);
    return { ...report, evaluation };
  } catch (error) {
    return { status: "ADAPTER_FAILED", errorCode: error instanceof Rejected ? error.code : "ACQUISITION_FAILED" };
  }
}

// Importing this file reads no environment and opens no connection. No dotenv,
// filesystem writer, market-data client, runner or persistence module is used.
async function main() {
  let report;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const input = parseArguments(process.argv.slice(2));
    input.databaseUrl = process.env.TECHNICAL_BB_PHASE8_DEV_DATABASE_URL;
    // Validate before loading a database library, let alone making a connection.
    validateDestination(input.databaseUrl);
    const { default: Client } = await import("pg/lib/client.js");
    report = await evaluateDevReadonly(input, { signal: controller.signal, createClient: (options) => {
      const client = new Client(options);
      // Idle socket errors must never become unhandled, credential-bearing output.
      client.on("error", () => {});
      return client;
    } });
  } catch (error) {
    report = { status: "ADAPTER_FAILED", errorCode: error instanceof Rejected ? error.code : "ADAPTER_FAILED" };
  }
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
  process.stdout.write(`${canonicalPhase8Json(report)}\n`);
  if (report.status === "ADAPTER_FAILED" || report.evaluation?.errorCode) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
