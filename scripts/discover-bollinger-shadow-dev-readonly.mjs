import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { validateDestination, DEV_REF } from './evaluate-bollinger-shadow-dev-readonly.mjs';
import { observeTls } from './probe-bollinger-shadow-dev-connection.mjs';

// Independent, manual discovery only. Importing never reads env or loads pg.
// Real execution requires separate authorization; offline tests inject every IO.
// No evaluator calls, cutoff selection, market-data fetch or persistence.
export const LIMITS = Object.freeze({ connectionMs: 5000, statementMs: 3000,
  applicationMs: 10000, cleanupMs: 2000, rollbackMs: 1000,
  snapshots: 10000, events: 10000, results: 30000,
  days: 366, sourceBytes: 1024 * 1024, outputBytes: 1024 * 1024 });
const ENV = 'TECHNICAL_BB_PHASE8_DEV_DATABASE_URL';
const LIMITATIONS = Object.freeze([
  'Coverage only: no evaluation arguments are selected or approved.',
  'All transaction-visible rows are included, including out-of-scope provenance.',
  'Transaction timestamp is acquisition metadata, not a source-cutoff recommendation.',
  'created_at is not a commit timestamp; immutable historical row versions do not exist.',
  'Availability is not result validity, calendar readiness or completeness at a later chosen cutoff.',
]);
class Failure extends Error { constructor(code) { super(code); this.code = code; } }
const requireThat = (condition, code) => { if (!condition) throw new Failure(code); };
const failed = (failureClass) => ({ DISCOVERY_STATUS: 'FAIL', FAILURE_CLASS: failureClass });

// Private fixed statements. Only bound numeric caps are supplied by the caller.
// JSON equality deliberately excludes strings/numbers pretending to be booleans
// or phase="7". COALESCE makes every unknown/NULL predicate a non-match.
const SQL = Object.freeze({
  begin: 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
  guard: `SELECT current_database() AS database_name, current_user AS current_role,
    session_user AS session_role, current_setting('transaction_read_only') AS read_only,
    current_setting('transaction_isolation') AS isolation,
    transaction_timestamp()::text AS transaction_timestamp`,
  budget: `SELECT
    (SELECT COUNT(*)::text FROM (SELECT 1 FROM public.technical_bb_observation_snapshots LIMIT $1) s) AS snapshots,
    (SELECT COUNT(*)::text FROM (SELECT 1 FROM public.technical_bb_observation_events LIMIT $2) e) AS events,
    (SELECT COUNT(*)::text FROM (SELECT 1 FROM public.technical_bb_observation_results LIMIT $3) r) AS results`,
  relationships: `SELECT EXISTS (
    SELECT 1 FROM public.technical_bb_observation_events e
    LEFT JOIN public.technical_bb_observation_snapshots s ON s.id=e.snapshot_id WHERE s.id IS NULL
    UNION ALL
    SELECT 1 FROM public.technical_bb_observation_results r
    LEFT JOIN public.technical_bb_observation_events e ON e.id=r.event_id WHERE e.id IS NULL
    ) AS invalid`,
  daily: `WITH snapshot_days AS (
    SELECT s.observation_date,
      COUNT(*)::text AS snapshot_count, COUNT(DISTINCT s.code)::text AS symbol_count,
      COUNT(*) FILTER (WHERE COALESCE(s.timeframe='1D' AND s.provider='YAHOO_CHART'
        AND s.timezone='Asia/Tokyo' AND s.detector_version='BB_OBSERVATION_V1'
        AND s.metadata->'shadowOnly'='true'::jsonb AND s.metadata->'phase'='"7"'::jsonb
        AND s.metadata->'executionSource'='"PHASE_7_SHADOW_AUTOMATION"'::jsonb, FALSE))::text AS target_count,
      MIN(s.created_at)::text AS snapshot_created_at_min, MAX(s.created_at)::text AS snapshot_created_at_max,
      MIN(s.bar_end_at)::text AS bar_end_at_min, MAX(s.bar_end_at)::text AS bar_end_at_max
    FROM public.technical_bb_observation_snapshots s GROUP BY s.observation_date
  ), event_days AS (
    SELECT s.observation_date, COUNT(*)::text AS event_count,
      MIN(e.created_at)::text AS event_created_at_min, MAX(e.created_at)::text AS event_created_at_max
    FROM public.technical_bb_observation_events e
    JOIN public.technical_bb_observation_snapshots s ON s.id=e.snapshot_id GROUP BY s.observation_date
  ), result_days AS (
    SELECT s.observation_date, COUNT(*)::text AS result_count,
      COUNT(*) FILTER (WHERE r.horizon=1)::text AS h1_count,
      COUNT(*) FILTER (WHERE r.horizon=3)::text AS h3_count,
      COUNT(*) FILTER (WHERE r.horizon=5)::text AS h5_count,
      COUNT(*) FILTER (WHERE r.result_version IS DISTINCT FROM 'BB_OBSERVATION_RESULT_V1')::text AS version_mismatch_count,
      COUNT(*) FILTER (WHERE r.result_quality IS DISTINCT FROM 'COMPLETE')::text AS quality_mismatch_count,
      MIN(r.created_at)::text AS result_created_at_min, MAX(r.created_at)::text AS result_created_at_max,
      MIN(r.evaluated_at)::text AS evaluated_at_min, MAX(r.evaluated_at)::text AS evaluated_at_max,
      MIN(r.evaluated_trade_date)::text AS evaluated_trade_date_min, MAX(r.evaluated_trade_date)::text AS evaluated_trade_date_max,
      MIN(r.evaluated_trade_date) FILTER (WHERE r.horizon=1)::text AS h1_trade_date_min,
      MAX(r.evaluated_trade_date) FILTER (WHERE r.horizon=1)::text AS h1_trade_date_max,
      MIN(r.evaluated_trade_date) FILTER (WHERE r.horizon=3)::text AS h3_trade_date_min,
      MAX(r.evaluated_trade_date) FILTER (WHERE r.horizon=3)::text AS h3_trade_date_max,
      MIN(r.evaluated_trade_date) FILTER (WHERE r.horizon=5)::text AS h5_trade_date_min,
      MAX(r.evaluated_trade_date) FILTER (WHERE r.horizon=5)::text AS h5_trade_date_max
    FROM public.technical_bb_observation_results r
    JOIN public.technical_bb_observation_events e ON e.id=r.event_id
    JOIN public.technical_bb_observation_snapshots s ON s.id=e.snapshot_id GROUP BY s.observation_date
  ) SELECT s.observation_date::text, s.snapshot_count, s.symbol_count, s.target_count,
    s.snapshot_created_at_min, s.snapshot_created_at_max, s.bar_end_at_min, s.bar_end_at_max,
    COALESCE(e.event_count,'0') AS event_count, e.event_created_at_min, e.event_created_at_max,
    COALESCE(r.result_count,'0') AS result_count, COALESCE(r.h1_count,'0') AS h1_count,
    COALESCE(r.h3_count,'0') AS h3_count, COALESCE(r.h5_count,'0') AS h5_count,
    COALESCE(r.version_mismatch_count,'0') AS version_mismatch_count,
    COALESCE(r.quality_mismatch_count,'0') AS quality_mismatch_count,
    r.result_created_at_min, r.result_created_at_max, r.evaluated_at_min, r.evaluated_at_max,
    r.evaluated_trade_date_min, r.evaluated_trade_date_max,
    r.h1_trade_date_min, r.h1_trade_date_max, r.h3_trade_date_min, r.h3_trade_date_max,
    r.h5_trade_date_min, r.h5_trade_date_max
  FROM snapshot_days s LEFT JOIN event_days e ON e.observation_date=s.observation_date
    LEFT JOIN result_days r ON r.observation_date=s.observation_date
  ORDER BY s.observation_date LIMIT $1`,
  rollback: 'ROLLBACK',
});
const COUNTS = Object.freeze(['snapshot_count', 'symbol_count', 'target_count', 'event_count',
  'result_count', 'h1_count', 'h3_count', 'h5_count', 'version_mismatch_count', 'quality_mismatch_count']);
const RANGES = Object.freeze([
  ['snapshot_created_at', 'snapshot_count', 'timestamp'], ['bar_end_at', 'snapshot_count', 'timestamp'],
  ['event_created_at', 'event_count', 'timestamp'], ['result_created_at', 'result_count', 'timestamp'],
  ['evaluated_at', 'result_count', 'timestamp'], ['evaluated_trade_date', 'result_count', 'date'],
  ['h1_trade_date', 'h1_count', 'date'], ['h3_trade_date', 'h3_count', 'date'], ['h5_trade_date', 'h5_count', 'date'],
]);
function count(value) {
  requireThat(typeof value === 'string' && /^(0|[1-9]\d{0,15})$/.test(value), 'INVALID_AGGREGATE');
  const n = Number(value);
  requireThat(Number.isSafeInteger(n), 'INVALID_AGGREGATE'); return n;
}
function date(value) {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
    && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value, 'INVALID_DATE');
  return value;
}
function timestamp(value) {
  requireThat(typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?\+00(?::00)?$/.test(value), 'INVALID_TIMESTAMP');
  date(value.slice(0, 10));
  requireThat(Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60
    && Number(value.slice(17, 19)) < 60, 'INVALID_TIMESTAMP');
  // UTC and exact microseconds, never JS rounding for range comparisons.
  const fractional = value.match(/\.(\d+)/)?.[1] ?? '';
  return BigInt(Date.parse(value.slice(0, 19).replace(' ', 'T') + 'Z')) * 1000n
    + BigInt(fractional.padEnd(6, '0'));
}
function rows(result, cap) {
  requireThat(result?.command === 'SELECT' && Array.isArray(result.rows)
    && result.rows.length <= cap, 'INVALID_QUERY_RESULT');
  for (const row of result.rows) requireThat(row && typeof row === 'object' && !Array.isArray(row), 'INVALID_QUERY_RESULT');
  return result.rows;
}
function one(result) { const found = rows(result, 1); requireThat(found.length === 1, 'INVALID_QUERY_RESULT'); return found[0]; }
function projectDaily(raw, totals, limits) {
  requireThat(raw.length <= limits.days, 'DAY_LIMIT_EXCEEDED');
  const sums = { snapshots: 0, events: 0, results: 0 }, daily = [];
  for (const row of raw) {
    const day = { observation_date: date(row.observation_date) };
    requireThat(!daily.length || daily.at(-1).observation_date < day.observation_date, 'INVALID_DAY_ORDER');
    for (const key of COUNTS) day[key] = count(row[key]);
    requireThat(day.snapshot_count > 0 && day.symbol_count > 0 && day.symbol_count <= day.snapshot_count
      && day.target_count <= day.snapshot_count
      && day.version_mismatch_count <= day.result_count && day.quality_mismatch_count <= day.result_count
      && day.h1_count + day.h3_count + day.h5_count === day.result_count, 'INVALID_AGGREGATE');
    for (const [name, countKey, kind] of RANGES) {
      const min = row[name + '_min'], max = row[name + '_max'];
      if (day[countKey] === 0) requireThat(min === null && max === null, 'INVALID_AGGREGATE');
      else requireThat((kind === 'date' ? date(min) <= date(max) : timestamp(min) <= timestamp(max)), 'INVALID_RANGE');
      day[name + '_min'] = min; day[name + '_max'] = max;
    }
    day.outside_or_unknown_count = day.snapshot_count - day.target_count;
    sums.snapshots += day.snapshot_count; sums.events += day.event_count; sums.results += day.result_count;
    for (const key of Object.keys(sums)) requireThat(sums[key] <= limits[key], 'ROW_LIMIT_EXCEEDED');
    daily.push(day);
  }
  for (const key of Object.keys(sums)) requireThat(sums[key] === totals[key], 'AGGREGATE_TOTAL_MISMATCH');
  return daily;
}
function summary(daily, target = false) {
  const selected = target ? daily.filter(day => day.target_count > 0) : daily;
  return { observation_date_min: selected[0]?.observation_date ?? null,
    observation_date_max: selected.at(-1)?.observation_date ?? null,
    distinct_observation_days: selected.length,
    snapshot_count: selected.reduce((total, day) => total + day[target ? 'target_count' : 'snapshot_count'], 0) };
}
function limitsFor(overrides) {
  requireThat(overrides && typeof overrides === 'object' && !Array.isArray(overrides), 'INVALID_LIMITS');
  for (const [key, value] of Object.entries(overrides)) requireThat(Object.hasOwn(LIMITS, key)
    && Number.isSafeInteger(value) && value > 0 && value <= LIMITS[key], 'INVALID_LIMITS');
  return { ...LIMITS, ...overrides };
}

// Trusted test injection only; no default client. Real CLI uses observeTls.
export async function discoverDevReadonly(input, { createClient, loadClient, observe = observeTls,
  now = () => performance.now(), signal, limits: overrides = {} } = {}) {
  let limits, client, began = false, socketError = null, output, primary = null;
  let rollbackFailed = false, closeFailed = false, deadline = now() + LIMITS.applicationMs;
  const check = () => {
    requireThat(now() < deadline, 'APPLICATION_DEADLINE_EXCEEDED');
    requireThat(!signal?.aborted, 'CANCELLED');
    if (socketError) throw socketError;
  };
  async function wait(action, end, code, active = false) {
    let timer, abort;
    const checkWait = () => { if (active) check(); requireThat(now() < end, code); };
    try {
      checkWait();
      const pending = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Failure(active && now() >= deadline
          ? 'APPLICATION_DEADLINE_EXCEEDED' : code)), Math.max(1, Math.ceil(end - now())));
        if (active) { abort = () => reject(new Failure(now() >= deadline ? 'APPLICATION_DEADLINE_EXCEEDED' : 'CANCELLED'));
          signal?.addEventListener('abort', abort, { once: true }); }
      });
      const value = await Promise.race([Promise.resolve().then(() => { checkWait(); return action(); }), pending]);
      checkWait(); return value;
    } catch (error) {
      if (active) check();
      requireThat(now() < end, code); throw error;
    } finally { clearTimeout(timer); if (abort) signal?.removeEventListener('abort', abort); }
  }
  try {
    const startedAt = deadline - LIMITS.applicationMs;
    limits = limitsFor(overrides); deadline = startedAt + limits.applicationMs;
    requireThat(input && Object.keys(input).every(key => ['confirmDev', 'databaseUrl'].includes(key))
      && input.confirmDev === DEV_REF, 'CONFIGURATION_INVALID');
    let options;
    try { options = validateDestination(input.databaseUrl); } catch { throw new Failure('CONFIGURATION_INVALID'); }
    check();
    options.connectionTimeoutMillis = Math.min(limits.connectionMs, Math.ceil(deadline - now()));
    options.statement_timeout = limits.statementMs; options.query_timeout = limits.statementMs;
    options.idle_in_transaction_session_timeout = limits.applicationMs;
    options.application_name = 'phase8_discovery_readonly';
    if (loadClient) createClient = await wait(loadClient, deadline, 'APPLICATION_DEADLINE_EXCEEDED', true);
    check(); requireThat(typeof createClient === 'function', 'CLIENT_FACTORY_REQUIRED');
    client = createClient(options);
    client.on('error', error => { socketError = error || new Failure('ACQUISITION_FAILED'); });
    await wait(() => client.connect(), Math.min(deadline, now() + limits.connectionMs), 'CONNECTION_TIMEOUT', true);
    requireThat(observe(client) === true, 'TLS_VERIFICATION_FAILED'); check();
    let sourceBytes = 0;
    const query = async (operation, values = []) => {
      requireThat(Object.hasOwn(SQL, operation), 'UNREGISTERED_QUERY'); check();
      const end = Math.min(deadline, now() + limits.statementMs);
      return wait(() => { if (operation === 'begin') began = true;
        return client.query({ text: SQL[operation], values, query_timeout: Math.max(1, Math.ceil(end - now())) });
      }, end, 'QUERY_TIMEOUT', true);
    };
    const receive = async (operation, values = [], cap = 1) => {
      const result = await query(operation, values); rows(result, cap);
      sourceBytes += Buffer.byteLength(JSON.stringify(result.rows));
      requireThat(sourceBytes <= limits.sourceBytes, 'SOURCE_BYTE_LIMIT_EXCEEDED'); return result;
    };
    requireThat((await query('begin'))?.command === 'BEGIN', 'BEGIN_FAILED');
    const guard = one(await receive('guard'));
    requireThat(guard.database_name === 'postgres' && guard.current_role === 'postgres'
      && guard.session_role === 'postgres', 'IDENTITY_MISMATCH');
    requireThat(guard.read_only === 'on', 'READ_ONLY_GUARD_FAILED');
    requireThat(guard.isolation === 'repeatable read', 'ISOLATION_GUARD_FAILED');
    timestamp(guard.transaction_timestamp);
    const budget = one(await receive('budget', [limits.snapshots + 1, limits.events + 1, limits.results + 1]));
    const totals = {};
    for (const key of ['snapshots', 'events', 'results']) {
      totals[key] = count(budget[key]); requireThat(totals[key] <= limits[key], 'ROW_LIMIT_EXCEEDED');
    }
    requireThat(one(await receive('relationships')).invalid === false, 'RELATIONSHIP_INVALID');
    const daily = projectDaily(rows(await receive('daily', [limits.days + 1], limits.days + 1), limits.days + 1), totals, limits);
    const all = summary(daily), target = summary(daily, true);
    const status = !all.snapshot_count ? 'NO_DATA' : !target.snapshot_count ? 'NO_TARGET_SCOPE'
      : all.snapshot_count !== target.snapshot_count ? 'MIXED_SCOPE' : 'TARGET_SCOPE_ONLY';
    output = { DISCOVERY_STATUS: 'PASS', COVERAGE_STATUS: status, devProjectRef: DEV_REF,
      transaction_timestamp: guard.transaction_timestamp, all, target, daily,
      limitations: LIMITATIONS };
    requireThat(Buffer.byteLength(JSON.stringify(output) + '\n') <= limits.outputBytes, 'OUTPUT_BYTE_LIMIT_EXCEEDED'); check();
  } catch (error) {
    primary = now() >= deadline ? 'APPLICATION_DEADLINE_EXCEEDED'
      : error instanceof Failure ? error.code : 'ACQUISITION_FAILED';
  } finally {
    if (client) {
      const cleanupEnd = Math.min(now(), deadline) + limits.cleanupMs;
      if (began) {
        try {
          const end = Math.min(cleanupEnd, now() + limits.rollbackMs);
          const result = await wait(() => client.query({ text: SQL.rollback, values: [],
            query_timeout: Math.max(1, Math.ceil(end - now())) }), end, 'ROLLBACK_FAILED');
          requireThat(result?.command === 'ROLLBACK', 'ROLLBACK_FAILED');
        } catch { rollbackFailed = true; }
      }
      try {
        const ending = Promise.resolve(client.end()); ending.catch(() => {});
        await wait(() => ending, cleanupEnd, 'CLIENT_CLOSE_FAILED');
      } catch { closeFailed = true; }
      if (rollbackFailed || closeFailed) { try { client.connection?.stream?.destroy(); } catch { /* sanitized */ } }
    }
  }
  if (closeFailed) return failed('CLIENT_CLOSE_FAILED');
  if (rollbackFailed) return failed('ROLLBACK_FAILED');
  if (!primary && now() >= deadline) primary = 'APPLICATION_DEADLINE_EXCEEDED';
  if (!primary && signal?.aborted) primary = 'CANCELLED';
  if (!primary && socketError) primary = 'ACQUISITION_FAILED';
  return primary ? failed(primary) : output;
}

// No URI/SQL/date arguments, overrides, environment inheritance in test APIs.
export async function manualDiscovery(args, { readEnvironment, loadClient, ...dependencies } = {}) {
  if (!Array.isArray(args) || args.length !== 2 || args[0] !== '--confirm-dev' || args[1] !== DEV_REF
    || typeof readEnvironment !== 'function' || typeof loadClient !== 'function') return failed('CONFIGURATION_INVALID');
  try { return await discoverDevReadonly({ confirmDev: DEV_REF, databaseUrl: readEnvironment(ENV) },
    { ...dependencies, loadClient }); } catch { return failed('ACQUISITION_FAILED'); }
}
async function main() {
  const controller = new AbortController(), cancel = () => controller.abort();
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  const output = await manualDiscovery(process.argv.slice(2), {
    readEnvironment: name => process.env[name], signal: controller.signal,
    loadClient: async () => {
      const { setDefaultAutoSelectFamily } = await import('node:net');
      setDefaultAutoSelectFamily(false); // One direct address attempt; no fallback/retry.
      const { default: Client } = await import('pg/lib/client.js');
      return options => new Client(options);
    },
  });
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  process.stdout.write(JSON.stringify(output) + '\n');
  if (output.DISCOVERY_STATUS !== 'PASS') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
