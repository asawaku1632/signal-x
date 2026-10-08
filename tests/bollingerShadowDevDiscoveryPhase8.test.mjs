import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import tls from 'node:tls';
import { Session } from 'node:inspector/promises';
import { discoverDevReadonly, manualDiscovery, LIMITS } from '../scripts/discover-bollinger-shadow-dev-readonly.mjs';
import { evaluateDevReadonly } from '../scripts/evaluate-bollinger-shadow-dev-readonly.mjs';
import { evaluateBollingerShadow } from '../app/lib/technicalObservation/bollingerShadowEvaluation.ts';

// Synthetic fixtures only. No real environment, pg, SQL execution or sockets.
// Fixture dates deliberately do not represent an approved evaluation period.
const DEV = 'jdtqwryiyxeuoraecorw', PROD = 'paygtakajhvatwejygda';
const HOST = `db.${DEV}.supabase.co`;
const destination = new URL(`postgresql://${HOST}/postgres`);
destination.username = 'postgres'; destination.password = 'offline-mock-value'; destination.port = '5432';
const mockUrl = destination.href;
const networkOriginals = [net.connect, net.createConnection, tls.connect];
let networkAttempts = 0;
const denyNetwork = () => { networkAttempts++; assert.fail('offline suite attempted a socket'); };
net.connect = denyNetwork; net.createConnection = denyNetwork; tls.connect = denyNetwork;
after(() => {
  [net.connect, net.createConnection, tls.connect] = networkOriginals;
  assert.equal(networkAttempts, 0);
});
const guard = () => ({ database_name: 'postgres', current_role: 'postgres', session_role: 'postgres',
  read_only: 'on', isolation: 'repeatable read', transaction_timestamp: '2031-02-10 06:40:00.123456+00' });
const day = (extra = {}) => ({ observation_date: '2031-02-03', snapshot_count: '3', symbol_count: '2', target_count: '2',
  snapshot_created_at_min: '2031-02-03 06:40:00+00', snapshot_created_at_max: '2031-02-03 06:45:00+00',
  bar_end_at_min: '2031-02-03 06:30:00+00', bar_end_at_max: '2031-02-03 06:30:00+00',
  event_count: '2', event_created_at_min: '2031-02-03 06:40:00+00', event_created_at_max: '2031-02-03 06:45:00+00',
  result_count: '4', h1_count: '2', h3_count: '1', h5_count: '1', version_mismatch_count: '1', quality_mismatch_count: '1',
  result_created_at_min: '2031-02-04 06:40:00+00', result_created_at_max: '2031-02-10 06:40:00+00',
  evaluated_at_min: '2031-02-04 06:40:00.000001+00', evaluated_at_max: '2031-02-10 06:40:00.123456+00',
  evaluated_trade_date_min: '2031-02-04', evaluated_trade_date_max: '2031-02-10',
  h1_trade_date_min: '2031-02-04', h1_trade_date_max: '2031-02-04',
  h3_trade_date_min: '2031-02-06', h3_trade_date_max: '2031-02-06',
  h5_trade_date_min: '2031-02-10', h5_trade_date_max: '2031-02-10', ...extra });
function fixture({ daily = [day()], metadata = guard(), budget, invalid = false,
  hook = () => {}, response = (_op, result) => result, observe = () => true,
  limits = {}, signal, url = mockUrl } = {}) {
  const state = { time: 0, calls: [], queries: [], factories: 0, destroyed: 0, options: null, listener: null };
  const totals = budget ?? { snapshots: String(daily.reduce((n, r) => n + Number(r.snapshot_count), 0)),
    events: String(daily.reduce((n, r) => n + Number(r.event_count), 0)),
    results: String(daily.reduce((n, r) => n + Number(r.result_count), 0)) };
  const client = {
    on(name, fn) { assert.equal(name, 'error'); state.listener = fn; },
    connection: { stream: { destroy() { state.destroyed++; } } },
    async connect() { state.calls.push('connect'); await hook('connect', state); },
    async query(q) {
      const op = q.text === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' ? 'begin'
        : q.text === 'ROLLBACK' ? 'rollback' : q.text.startsWith('SELECT current_database()') ? 'guard'
          : q.text.startsWith('SELECT\n    (SELECT COUNT(*)') ? 'budget'
            : q.text.startsWith('SELECT EXISTS (') ? 'relationships'
              : q.text.startsWith('WITH snapshot_days AS (') ? 'daily' : null;
      assert.ok(op, 'fixed SQL only'); state.calls.push(op); state.queries.push(q);
      await hook(op, state);
      const result = op === 'begin' || op === 'rollback' ? { command: op.toUpperCase() }
        : { command: 'SELECT', rows: op === 'guard' ? [metadata] : op === 'budget' ? [totals]
          : op === 'relationships' ? [{ invalid }] : daily };
      return response(op, result);
    },
    async end() { state.calls.push('end'); await hook('end', state); },
  };
  const dependencies = { createClient(options) { state.factories++; state.options = options;
    hook('factory', state); return client; }, observe, now: () => state.time, limits, signal };
  const input = { confirmDev: DEV, databaseUrl: url };
  return { state, client, dependencies, input, run: () => discoverDevReadonly(input, dependencies) };
}
function failure(out, code) {
  assert.deepEqual(out, { DISCOVERY_STATUS: 'FAIL', FAILURE_CLASS: code });
  assert.ok(!JSON.stringify(out).includes(destination.password));
}
const tainted = () => new Error(mockUrl + ' raw-error-must-not-leak');
const never = () => new Promise(() => {});

test('mixed provenance is visible with exact counts, timestamps, ranges and strict TLS/identity', async () => {
  const f = fixture(), out = await f.run();
  assert.equal(out.DISCOVERY_STATUS, 'PASS'); assert.equal(out.COVERAGE_STATUS, 'MIXED_SCOPE');
  assert.equal(out.transaction_timestamp, guard().transaction_timestamp);
  assert.deepEqual(out.all, { observation_date_min: '2031-02-03', observation_date_max: '2031-02-03',
    distinct_observation_days: 1, snapshot_count: 3 });
  assert.equal(out.target.snapshot_count, 2); assert.equal(out.daily[0].outside_or_unknown_count, 1);
  assert.equal(out.daily[0].h1_count, 2); assert.equal(out.daily[0].h3_count, 1); assert.equal(out.daily[0].h5_count, 1);
  assert.equal(out.daily[0].version_mismatch_count, 1); assert.equal(out.daily[0].quality_mismatch_count, 1);
  assert.equal(out.daily[0].evaluated_at_max, day().evaluated_at_max);
  assert.deepEqual(f.state.calls, ['connect', 'begin', 'guard', 'budget', 'relationships', 'daily', 'rollback', 'end']);
  assert.equal(f.state.factories, 1);
  assert.equal(f.state.options.host, HOST); assert.equal(f.state.options.port, 5432);
  assert.equal(f.state.options.database, 'postgres'); assert.equal(f.state.options.user, 'postgres');
  assert.deepEqual(f.state.options.ssl, { rejectUnauthorized: true, servername: HOST });
  assert.ok(f.state.options.options.includes('default_transaction_read_only=on'));
  assert.ok(f.state.options.options.includes('timezone=UTC'));
  assert.equal(f.state.options.statement_timeout, LIMITS.statementMs);
  assert.equal(f.state.options.idle_in_transaction_session_timeout, LIMITS.applicationMs);
  assert.deepEqual(f.state.queries.find(q => q.text.startsWith('SELECT\n    (SELECT COUNT(*)')).values,
    [LIMITS.snapshots + 1, LIMITS.events + 1, LIMITS.results + 1]);
  assert.deepEqual(f.state.queries.find(q => q.text.startsWith('WITH')).values, [LIMITS.days + 1]);
  const text = JSON.stringify(out);
  assert.ok(!/"sourceCutoff"|"source-cutoff"|"from"|"through"|return_percent|entry_price|BUY|SELL|WAIT|password|postgresql:|raw-error/.test(text));
});

test('target MIN/MAX and distinct days do not include dates having only outside scope', async () => {
  const out = await fixture({ daily: [day({ target_count: '0' }), day({ observation_date: '2031-02-05', target_count: '3' })] }).run();
  assert.equal(out.all.distinct_observation_days, 2); assert.equal(out.all.snapshot_count, 6);
  assert.equal(out.target.distinct_observation_days, 1); assert.equal(out.target.observation_date_min, '2031-02-05');
  assert.equal(out.daily.length, 2); assert.equal(out.daily[0].outside_or_unknown_count, 3);
});
test('empty data has null extrema and explicitly NO_DATA; no fixture defaults', async () => {
  const out = await fixture({ daily: [] }).run();
  assert.equal(out.COVERAGE_STATUS, 'NO_DATA'); assert.deepEqual(out.daily, []);
  assert.deepEqual(out.all, { observation_date_min: null, observation_date_max: null, distinct_observation_days: 0, snapshot_count: 0 });
  assert.deepEqual(out.target, out.all);
});
test('no target scope never looks like usable target coverage', async () => {
  const out = await fixture({ daily: [day({ target_count: '0' })] }).run();
  assert.equal(out.COVERAGE_STATUS, 'NO_TARGET_SCOPE'); assert.equal(out.daily[0].outside_or_unknown_count, 3);
  assert.equal(out.target.observation_date_min, null);
});
test('pure scope is coverage only, without evaluation or cutoff certification', async () => {
  const out = await fixture({ daily: [day({ target_count: '3' })] }).run();
  assert.equal(out.COVERAGE_STATUS, 'TARGET_SCOPE_ONLY'); assert.equal(out.evaluation, undefined);
  assert.ok(out.limitations.some(s => s.includes('not a source-cutoff')));
});
test('zero events/results retain snapshots and null availability, not fabricated results', async () => {
  const row = day({ event_count: '0', event_created_at_min: null, event_created_at_max: null,
    result_count: '0', h1_count: '0', h3_count: '0', h5_count: '0', version_mismatch_count: '0', quality_mismatch_count: '0' });
  for (const key of Object.keys(row)) if (/^(result_created_at|evaluated_|h[135]_trade_date)/.test(key)) row[key] = null;
  const out = await fixture({ daily: [row] }).run();
  assert.equal(out.DISCOVERY_STATUS, 'PASS'); assert.equal(out.daily[0].snapshot_count, 3);
  assert.equal(out.daily[0].result_created_at_min, null);
});

for (const [name, url] of [
  ['production host', mockUrl.replace(DEV, PROD)], ['production username', mockUrl.replace('postgres:', PROD + ':')],
  ['production path', mockUrl + '/' + PROD], ['alternate host', mockUrl.replace(HOST, 'example.test')],
  ['host suffix', mockUrl.replace(HOST, HOST + '.example.test')], ['pooler', mockUrl.replace(HOST, 'pooler.supabase.com')],
  ['6543', mockUrl.replace(':5432', ':6543')], ['role', mockUrl.replace('postgres:', 'reader:')],
  ['database', mockUrl.replace('/postgres', '/other')], ['query options', mockUrl + '?sslmode=disable'],
  ['fragment', mockUrl + '#anything'], ['missing', undefined], ['malformed', 'bad'],
]) test('destination rejects ' + name + ' before construction or driver load', async () => {
  const f = fixture({ url }); let loaded = 0;
  // Explicitly preserve undefined: fixture default is only for happy-path setup.
  failure(await discoverDevReadonly({ confirmDev: DEV, databaseUrl: url }, { ...f.dependencies,
    loadClient() { loaded++; assert.fail('driver loaded for invalid destination'); } }), 'CONFIGURATION_INVALID');
  assert.equal(f.state.factories, 0); assert.equal(loaded, 0); assert.deepEqual(f.state.calls, []);
});
for (const input of [null, {}, { confirmDev: PROD, databaseUrl: mockUrl },
  { confirmDev: DEV, databaseUrl: mockUrl, sql: 'SELECT 1' },
  { confirmDev: DEV, databaseUrl: mockUrl, from: '2031-02-03' },
  { confirmDev: DEV, databaseUrl: mockUrl, sourceCutoff: guard().transaction_timestamp }])
  test('configuration cannot widen surface: ' + Object.keys(input ?? {}).join(','), async () => {
    const f = fixture(); failure(await discoverDevReadonly(input, f.dependencies), 'CONFIGURATION_INVALID');
    assert.equal(f.state.factories, 0);
  });
for (const args of [[], ['--confirm-dev', PROD], ['--confirm-dev', DEV, '--from', '2031-02-03'],
  ['--confirm-dev', DEV, '--source-cutoff', '2031-02-10T06:40:00.000Z'], ['--sql', 'SELECT 1'],
  ['--confirm-dev', DEV, '--confirm-dev', DEV], ['__proto__', DEV]])
  test('CLI rejects unapproved arguments before environment access: ' + args[0], async () => {
    failure(await manualDiscovery(args, { readEnvironment() { assert.fail('environment read'); },
      loadClient() { assert.fail('driver load'); } }), 'CONFIGURATION_INVALID');
  });
test('exported API has no default client and does not load pg', async () => {
  failure(await discoverDevReadonly({ confirmDev: DEV, databaseUrl: mockUrl }), 'CLIENT_FACTORY_REQUIRED');
  failure(await manualDiscovery(['--confirm-dev', DEV]), 'CONFIGURATION_INVALID');
});
test('manual API uses injected environment and driver only, never a real environment', async () => {
  const f = fixture(); let reads = 0, loads = 0;
  const { createClient, ...dependencies } = f.dependencies;
  const out = await manualDiscovery(['--confirm-dev', DEV], { ...dependencies,
    readEnvironment(name) { assert.equal(name, 'TECHNICAL_BB_PHASE8_DEV_DATABASE_URL'); reads++; return mockUrl; },
    loadClient() { loads++; return createClient; } });
  assert.equal(out.DISCOVERY_STATUS, 'PASS'); assert.equal(reads, 1); assert.equal(loads, 1);
});
test('injected environment/driver failures never leak raw error', async () => {
  failure(await manualDiscovery(['--confirm-dev', DEV], { readEnvironment() { throw tainted(); }, loadClient() {} }), 'ACQUISITION_FAILED');
  failure(await manualDiscovery(['--confirm-dev', DEV], { readEnvironment: () => mockUrl, loadClient() { throw tainted(); } }), 'ACQUISITION_FAILED');
});

for (const value of [false, undefined, null, 'true', 1]) test('TLS must be exact true: ' + String(value), async () => {
  const f = fixture({ observe: () => value }); failure(await f.run(), 'TLS_VERIFICATION_FAILED');
  assert.deepEqual(f.state.calls, ['connect', 'end']);
});
test('default TLS observer cannot be bypassed by a mock client without TLS evidence', async () => {
  const f = fixture(); delete f.dependencies.observe;
  failure(await f.run(), 'TLS_VERIFICATION_FAILED');
});
for (const [key, value, code] of [
  ['database_name', 'other', 'IDENTITY_MISMATCH'], ['current_role', 'reader', 'IDENTITY_MISMATCH'],
  ['session_role', 'reader', 'IDENTITY_MISMATCH'], ['read_only', 'off', 'READ_ONLY_GUARD_FAILED'],
  ['read_only', true, 'READ_ONLY_GUARD_FAILED'], ['isolation', 'read committed', 'ISOLATION_GUARD_FAILED'],
  ['transaction_timestamp', '2031-02-30 06:40:00+00', 'INVALID_DATE'],
  ['transaction_timestamp', '2031-02-10 24:00:00+00', 'INVALID_TIMESTAMP'],
  ['transaction_timestamp', '2031-02-10 06:40:00+09', 'INVALID_TIMESTAMP'],
]) test('guard refuses ' + key + '=' + value + ' before table reads', async () => {
  const f = fixture({ metadata: { ...guard(), [key]: value } }); failure(await f.run(), code);
  assert.deepEqual(f.state.calls, ['connect', 'begin', 'guard', 'rollback', 'end']);
});
for (const op of ['begin', 'guard', 'budget', 'relationships', 'daily'])
  test('query failure at ' + op + ' drops all data and rolls back', async () => {
    const f = fixture({ hook(current) { if (current === op) throw tainted(); } });
    failure(await f.run(), 'ACQUISITION_FAILED'); assert.deepEqual(f.state.calls.slice(-2), ['rollback', 'end']);
  });
for (const op of ['connect', 'factory']) test('failure at ' + op + ' sanitized, no fallback', async () => {
  const f = fixture({ hook(current) { if (current === op) throw tainted(); } });
  failure(await f.run(), 'ACQUISITION_FAILED'); assert.equal(f.state.factories, 1);
});
for (const op of ['begin', 'guard', 'budget', 'relationships', 'daily'])
  test('invalid command/row shape at ' + op + ' is fail-closed', async () => {
    const f = fixture({ response(current, result) { return current === op ? { command: 'OTHER', rows: [] } : result; } });
    failure(await f.run(), op === 'begin' ? 'BEGIN_FAILED' : 'INVALID_QUERY_RESULT');
  });
for (const malformed of [[], [guard(), guard()], [null], ['bad'], [[]]]) test('guard shape ' + JSON.stringify(malformed), async () => {
  failure(await fixture({ response(op, result) { return op === 'guard' ? { command: 'SELECT', rows: malformed } : result; } }).run(), 'INVALID_QUERY_RESULT');
});
test('orphan relationships abort before daily aggregate and never disappear in joins', async () => {
  const f = fixture({ invalid: true }); failure(await f.run(), 'RELATIONSHIP_INVALID');
  assert.ok(!f.state.calls.includes('daily'));
});

for (const key of ['snapshots', 'events', 'results']) test(key + ' input row cap refuses full-table aggregation', async () => {
  const f = fixture({ budget: { snapshots: '3', events: '2', results: '4', [key]: String(LIMITS[key] + 1) } });
  failure(await f.run(), 'ROW_LIMIT_EXCEEDED'); assert.ok(!f.state.calls.includes('daily'));
});
for (const limits of [{ applicationMs: LIMITS.applicationMs + 1 }, { statementMs: 0 }, { days: -1 },
  { sourceBytes: 1.5 }, { snapshots: NaN }, { sql: 1 }, JSON.parse('{"__proto__":1}')])
  test('limit override cannot increase or widen boundary: ' + Object.keys(limits), async () => {
    const f = fixture({ limits }); failure(await f.run(), 'INVALID_LIMITS'); assert.equal(f.state.factories, 0);
  });
test('day cap refuses partial/truncated discovery', async () => {
  failure(await fixture({ daily: [day(), day({ observation_date: '2031-02-04' })], limits: { days: 1 } }).run(), 'DAY_LIMIT_EXCEEDED');
});
test('source byte cap at guard aborts before budget, without metadata leak', async () => {
  const f = fixture({ limits: { sourceBytes: 1 } }); failure(await f.run(), 'SOURCE_BYTE_LIMIT_EXCEEDED');
  assert.ok(!f.state.calls.includes('budget'));
});
test('source byte cap includes every response, including daily rows', async () => {
  const f = fixture({ limits: { sourceBytes: 500 } }); failure(await f.run(), 'SOURCE_BYTE_LIMIT_EXCEEDED');
  assert.ok(f.state.calls.includes('daily'));
});
test('output cap includes JSON framing and newline at the exact admission boundary', async () => {
  const out = await fixture().run(), bytes = Buffer.byteLength(JSON.stringify(out) + '\n');
  assert.deepEqual(await fixture({ limits: { outputBytes: bytes } }).run(), out);
  failure(await fixture({ limits: { outputBytes: bytes - 1 } }).run(), 'OUTPUT_BYTE_LIMIT_EXCEEDED');
});
for (const [key, value, code] of [
  ['snapshot_count', '0', 'INVALID_AGGREGATE'], ['target_count', '4', 'INVALID_AGGREGATE'],
  ['symbol_count', '4', 'INVALID_AGGREGATE'], ['symbol_count', '0', 'INVALID_AGGREGATE'],
  ['event_count', null, 'INVALID_AGGREGATE'], ['event_count', 2, 'INVALID_AGGREGATE'],
  ['event_count', '-1', 'INVALID_AGGREGATE'], ['event_count', '1e2', 'INVALID_AGGREGATE'],
  ['event_count', '9007199254740992', 'INVALID_AGGREGATE'],
  ['h5_count', '0', 'INVALID_AGGREGATE'], ['version_mismatch_count', '5', 'INVALID_AGGREGATE'],
  ['quality_mismatch_count', '5', 'INVALID_AGGREGATE'], ['h1_trade_date_min', null, 'INVALID_DATE'],
  ['observation_date', '2031-02-30', 'INVALID_DATE'],
  ['snapshot_created_at_min', 'raw-error', 'INVALID_TIMESTAMP'],
  ['evaluated_at_min', '2031-02-10 06:40:00.123457+00', 'INVALID_RANGE'],
]) test('invalid aggregate ' + key + '=' + String(value) + ' drops coverage', async () => {
  failure(await fixture({ daily: [day({ [key]: value })], budget: { snapshots: '3', events: '2', results: '4' } }).run(), code);
});
test('zero count cannot retain non-null availability', async () => {
  failure(await fixture({ daily: [day({ h5_count: '0', result_count: '3' })] }).run(), 'INVALID_AGGREGATE');
});
test('unknown returned properties never reach the output', async () => {
  const out = await fixture({ daily: [day({ password: destination.password, raw_error: mockUrl })],
    metadata: { ...guard(), raw_error: mockUrl } }).run();
  assert.equal(out.DISCOVERY_STATUS, 'PASS'); assert.ok(!JSON.stringify(out).includes(destination.password));
});
test('daily total mismatch catches omitted parents or truncated aggregate', async () => {
  failure(await fixture({ budget: { snapshots: '4', events: '2', results: '4' } }).run(), 'AGGREGATE_TOTAL_MISMATCH');
});
for (const daily of [[day(), day()], [day({ observation_date: '2031-02-04' }), day()]])
  test('duplicate/unordered dates cannot produce discovery', async () => failure(await fixture({ daily }).run(), 'INVALID_DAY_ORDER'));

for (const failedOps of [['rollback'], ['end'], ['daily', 'rollback'], ['rollback', 'end']])
  test('cleanup failure ' + failedOps.join('+') + ' overrides success or acquisition failure', async () => {
    const f = fixture({ hook(op) { if (failedOps.includes(op)) throw tainted(); } });
    failure(await f.run(), failedOps.includes('end') ? 'CLIENT_CLOSE_FAILED' : 'ROLLBACK_FAILED');
    assert.deepEqual(f.state.calls.slice(-2), ['rollback', 'end']); assert.equal(f.state.destroyed, 1);
  });
test('uncertain BEGIN acknowledgement still attempts ROLLBACK exactly once', async () => {
  const f = fixture({ hook(op) { if (op === 'begin') throw tainted(); } }); await f.run();
  assert.equal(f.state.calls.filter(op => op === 'rollback').length, 1);
});
test('wrong ROLLBACK acknowledgement invalidates coverage', async () => {
  const f = fixture({ response(op, result) { return op === 'rollback' ? { command: 'COMMIT' } : result; } });
  failure(await f.run(), 'ROLLBACK_FAILED'); assert.equal(f.state.destroyed, 1);
});
for (const op of ['connect', 'guard', 'daily', 'rollback', 'end']) test('socket error at ' + op + ' never becomes success', async () => {
  const f = fixture({ hook(current, state) { if (current === op) state.listener(tainted()); } });
  failure(await f.run(), 'ACQUISITION_FAILED');
});
test('pre-cancelled call never constructs a client', async () => {
  const controller = new AbortController(); controller.abort(); const f = fixture({ signal: controller.signal });
  failure(await f.run(), 'CANCELLED'); assert.equal(f.state.factories, 0);
});
for (const op of ['factory', 'connect', 'begin', 'guard', 'budget', 'relationships', 'daily', 'rollback', 'end'])
  test('application deadline includes ' + op + ', cleanup and output validation', async () => {
    const f = fixture({ hook(current, state) {
      if (['rollback', 'end'].includes(op) && current === 'factory') state.time = 9500;
      if (current === op) state.time = LIMITS.applicationMs;
    } });
    failure(await f.run(), 'APPLICATION_DEADLINE_EXCEEDED');
    if (f.state.calls.includes('begin')) assert.deepEqual(f.state.calls.slice(-2), ['rollback', 'end']);
  });
test('connection budget expires before application deadline', async () => {
  failure(await fixture({ hook(op, state) { if (op === 'connect') state.time = LIMITS.connectionMs; } }).run(), 'CONNECTION_TIMEOUT');
});
test('statement budget expires before application deadline', async () => {
  failure(await fixture({ hook(op, state) { if (op === 'daily') state.time = LIMITS.statementMs; } }).run(), 'QUERY_TIMEOUT');
});
test('query timeout shrinks with remaining global budget', async () => {
  const f = fixture({ hook(op, state) { if (op === 'factory') state.time = 8500; } });
  assert.equal((await f.run()).DISCOVERY_STATUS, 'PASS');
  assert.equal(f.state.queries.find(q => q.text.startsWith('WITH')).query_timeout, 1500);
});
test('cancellation during pending query terminates acquisition and still rolls back', async () => {
  const controller = new AbortController(), f = fixture({ signal: controller.signal,
    hook(op) { if (op === 'daily') { controller.abort(); return never(); } } });
  failure(await f.run(), 'CANCELLED'); assert.deepEqual(f.state.calls.slice(-2), ['rollback', 'end']);
});
for (const op of ['connect', 'daily', 'rollback', 'end']) test('pending ' + op + ' is bounded by timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture({ limits: { connectionMs: 10, statementMs: 10, applicationMs: 30, cleanupMs: 10, rollbackMs: 5 },
    hook(current) { if (current === op) return never(); } });
  const running = f.run();
  for (let i = 0; i < 120 && !f.state.calls.includes(op); i++) await Promise.resolve();
  assert.ok(f.state.calls.includes(op)); t.mock.timers.tick(10);
  const out = await running;
  failure(out, op === 'connect' ? 'CONNECTION_TIMEOUT' : op === 'daily' ? 'QUERY_TIMEOUT'
    : op === 'rollback' ? 'ROLLBACK_FAILED' : 'CLIENT_CLOSE_FAILED');
});

test('SQL is closed, includes every date/scope, and aggregates children before joins to avoid count inflation', async () => {
  const f = fixture(); await f.run(); const texts = f.state.queries.map(q => q.text), daily = texts.find(text => text.startsWith('WITH'));
  assert.equal(texts.length, 6);
  for (const text of texts) assert.ok(/^(SELECT|WITH|BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY|ROLLBACK)/.test(text));
  assert.ok(!/SELECT\s+\*|\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|COMMIT|COPY|CALL|DO|SET)\b/i.test(texts.join('\n')));
  assert.ok(!/return_percent|future_close|entry_price|max_rise_percent|max_drawdown_percent/.test(daily));
  assert.ok(!/WHERE\s+s\.(?:timeframe|provider)|created_at\s*[<>]=|sourceCutoff/.test(daily));
  assert.ok(daily.includes("s.metadata->'shadowOnly'='true'::jsonb"));
  assert.ok(daily.includes("s.metadata->'phase'='\"7\"'::jsonb"));
  assert.ok(daily.includes("s.metadata->'executionSource'='\"PHASE_7_SHADOW_AUTOMATION\"'::jsonb"));
  assert.ok(daily.includes('COALESCE(s.timeframe=')); assert.ok(daily.includes(', FALSE)'));
  for (const predicate of ["s.timeframe='1D'", "s.provider='YAHOO_CHART'", "s.timezone='Asia/Tokyo'", "s.detector_version='BB_OBSERVATION_V1'"])
    assert.ok(daily.includes(predicate));
  assert.equal((daily.match(/GROUP BY s.observation_date/g) ?? []).length, 3);
  assert.ok(daily.includes('IS DISTINCT FROM')); assert.ok(daily.includes('ORDER BY s.observation_date LIMIT $1'));
});
test('import surface contains no runner, consumer, persistence, arbitrary SQL or environment loader', async () => {
  const src = await readFile(new URL('../scripts/discover-bollinger-shadow-dev-readonly.mjs', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/(?:from\s+|import\()(['"])([^'"]+)\1/g)].map(m => m[2]);
  assert.deepEqual(imports, ['node:perf_hooks', 'node:url', './evaluate-bollinger-shadow-dev-readonly.mjs',
    './probe-bollinger-shadow-dev-connection.mjs', 'node:net', 'pg/lib/client.js']);
  assert.ok(!/evaluateBollingerShadow\s*\(|evaluateDevReadonly\s*\(|fetch\s*\(|writeFile|appendFile|createWriteStream|dotenv|rejectUnauthorized:\s*false/.test(src));
  assert.ok(!/export\s+(?:const|function)\s+(?:SQL|query)/.test(src));
});
test('fresh import performs no env reads, pg load, socket attempts or output', () => {
  const url = new URL('../scripts/discover-bollinger-shadow-dev-readonly.mjs', import.meta.url).href;
  const code = `import net from 'node:net'; import tls from 'node:tls'; import dns from 'node:dns';
    import Module, { syncBuiltinESMExports } from 'node:module';
    const blocked = () => { throw new Error('offline IO forbidden'); };
    net.Socket.prototype.connect = blocked; net.connect = blocked; tls.connect = blocked;
    dns.lookup = blocked; globalThis.fetch = blocked; syncBuiltinESMExports();
    const originalLoad = Module._load;
    Module._load = function(name, ...args) { if (/^pg(?:\\/|$)/.test(name)) blocked();
      return originalLoad.call(this, name, ...args); };
    const env = process.env;
    process.env = new Proxy(env, { get(target, key) { if (String(key).includes('DATABASE_URL')) blocked();
      return target[key]; } });
    await import(${JSON.stringify(url)});`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code],
    { env: {}, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout, '');
});
test('discovery success/failure never invoke evaluator (registered V8 function-call breakpoints)', async () => {
  const session = new Session(); session.connect();
  // Register actual function objects, without an evaluator positive-control call.
  // Precise coverage omits never-called functions; breakpoints avoid a vacuous check.
  globalThis.__phase8DiscoveryForbiddenFunctions = [evaluateBollingerShadow, evaluateDevReadonly];
  let calls = 0;
  session.on('Debugger.paused', () => { calls++; session.post('Debugger.resume').catch(() => {}); });
  try {
    await session.post('Debugger.enable');
    for (let index = 0; index < 2; index++) {
      const { result } = await session.post('Runtime.evaluate', { expression: `globalThis.__phase8DiscoveryForbiddenFunctions[${index}]` });
      assert.equal(result.type, 'function'); assert.ok(result.objectId);
      const { breakpointId } = await session.post('Debugger.setBreakpointOnFunctionCall', { objectId: result.objectId });
      assert.ok(breakpointId);
    }
    await fixture().run(); await fixture({ invalid: true }).run(); await fixture({ daily: [] }).run();
    assert.equal(calls, 0);
  } finally {
    delete globalThis.__phase8DiscoveryForbiddenFunctions;
    await session.post('Debugger.disable'); session.disconnect();
  }
});
