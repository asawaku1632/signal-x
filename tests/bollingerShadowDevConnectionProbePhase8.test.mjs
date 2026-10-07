import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { probeConnection, manualProbe, observeTls, BUDGET } from '../scripts/probe-bollinger-shadow-dev-connection.mjs';

// All verification YES values below describe simulated clients, never real DEV.
const HOST = 'db.jdtqwryiyxeuoraecorw.supabase.co';
const URL_FIXTURE = `postgresql://postgres:synthetic-only@${HOST}:5432/postgres`;
const SQL = ['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;', `SELECT
  current_database() AS database_name,
  current_user AS current_role,
  session_user AS session_role,
  current_setting('transaction_read_only') AS read_only,
  current_setting('transaction_isolation') AS isolation;`, 'ROLLBACK;'];
const KEYS = ['PROBE_STATUS','CONNECTION_ESTABLISHED','TLS_VERIFIED','EXPECTED_HOST_MATCH',
  'EXPECTED_DATABASE_MATCH','EXPECTED_ROLE_MATCH','TRANSACTION_READ_ONLY','ISOLATION_REPEATABLE_READ',
  'ROLLBACK_COMPLETE','CLIENT_CLOSED','FAILURE_CLASS','REAL_DEV_CONNECTIVITY_VERIFIED',
  'SANITIZED_TLS_ERROR_CODE','SANITIZED_TLS_ERROR_CLASS','SANITIZED_AUTH_ERROR_CODE'];
const metadata = () => ({ database_name: 'postgres', current_role: 'postgres', session_role: 'postgres', read_only: 'on', isolation: 'repeatable read' });
function fixture({ rows = [metadata()], hook = () => {}, tls = true, url = URL_FIXTURE, observe, clock } = {}) {
  const state = { time: 0, factories: 0, destroyed: 0, calls: [], options: null, queries: [], listener: null };
  const client = {
    on(name, fn) { assert.equal(name, 'error'); state.listener = fn; },
    connection: { stream: { destroy() { state.destroyed++; } } },
    async connect() { state.calls.push('connect'); await hook('connect', state); },
    async query(q) {
      const i = SQL.indexOf(q.text); assert.ok(i >= 0, 'no SQL escape');
      const op = ['begin','metadata','rollback'][i]; state.calls.push(op); state.queries.push(q);
      await hook(op, state);
      return op === 'metadata' ? { rows } : { command: op.toUpperCase() };
    },
    async end() { state.calls.push('end'); await hook('end', state); },
  };
  const dependencies = { now: () => clock ? clock(state) : state.time,
    observe: observe || (() => tls), createClient(options) {
      state.factories++; state.options = options; hook('factory', state); return client;
    } };
  return { state, client, dependencies, run: () => probeConnection(url, dependencies) };
}
function failed(out, code) {
  assert.equal(out.PROBE_STATUS, 'FAIL'); assert.equal(out.FAILURE_CLASS, code);
  assert.equal(out.REAL_DEV_CONNECTIVITY_VERIFIED, 'NO');
  assert.deepEqual(Object.keys(out), KEYS);
  assert.ok(!JSON.stringify(out).includes('synthetic-only'));
}
function error(code) { return Object.assign(new Error(URL_FIXTURE), { code }); }
const never = () => new Promise(() => {});

function diagnostic(out, code = 'NOT_AVAILABLE', kind = 'NOT_AVAILABLE') {
  assert.equal(out.SANITIZED_TLS_ERROR_CODE, code);
  assert.equal(out.SANITIZED_TLS_ERROR_CLASS, kind);
}
for (const [code, kind, legacy] of [
  ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_CHAIN_TRUST', 'TLS_VERIFICATION_FAILED'],
  ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_CHAIN_TRUST', 'TLS_VERIFICATION_FAILED'],
  ['SELF_SIGNED_CERT_IN_CHAIN', 'CERT_CHAIN_TRUST', 'TLS_VERIFICATION_FAILED'],
  ['DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_CHAIN_TRUST', 'TLS_VERIFICATION_FAILED'],
  ['CERT_HAS_EXPIRED', 'CERT_EXPIRED', 'TLS_VERIFICATION_FAILED'],
  ['ERR_TLS_CERT_ALTNAME_INVALID', 'HOSTNAME_MISMATCH', 'TLS_VERIFICATION_FAILED'],
  ['ECONNRESET', 'OTHER', 'NETWORK_UNAVAILABLE'],
  ['EPROTO', 'PROTOCOL_OR_HANDSHAKE', 'UNEXPECTED_SANITIZED_FAILURE'],
]) test('TLS diagnostic allowlist: ' + code, async () => {
  const injected = { code };
  for (const key of ['message', 'stack', 'hostname', 'cert', 'cause']) {
    Object.defineProperty(injected, key, { get() { assert.fail('forbidden error property'); } });
  }
  const f = fixture({ hook(op) { if (op === 'connect') throw injected; } });
  const out = await f.run();
  failed(out, legacy); diagnostic(out, code, kind);
  assert.deepEqual(f.state.calls, ['connect', 'end']);
});
for (const code of [undefined, 'private-runtime-value', '__proto__', 'constructor',
  'CERT_NOT_YET_VALID', { toString() { assert.fail('no coercion'); } }]) {
  test('unknown TLS diagnostic is sanitized: ' + typeof code, async () => {
    const f = fixture({ hook(op) { if (op === 'connect') throw error(code); } });
    const out = await f.run();
    diagnostic(out, 'OTHER', 'OTHER');
    assert.ok(!JSON.stringify(out).includes('private-runtime-value'));
    assert.ok(!JSON.stringify(out).includes('synthetic-only'));
  });
}
test('TLS diagnostic survives close failure without changing cleanup precedence', async () => {
  const f = fixture({ hook(op) {
    if (op === 'connect') throw error('CERT_HAS_EXPIRED');
    if (op === 'end') throw error('ERR_TLS_CERT_ALTNAME_INVALID');
  } });
  const out = await f.run();
  failed(out, 'CLIENT_CLOSE_FAILED'); diagnostic(out, 'CERT_HAS_EXPIRED', 'CERT_EXPIRED');
  assert.deepEqual(f.state.calls, ['connect', 'end']); assert.equal(f.state.destroyed, 1);
});
test('socket error during connection captures diagnostic', async () => {
  const f = fixture({ hook(op, state) {
    if (op === 'connect') state.listener(error('UNABLE_TO_VERIFY_LEAF_SIGNATURE'));
  } });
  const out = await f.run();
  failed(out, 'TLS_VERIFICATION_FAILED');
  diagnostic(out, 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_CHAIN_TRUST');
});
test('TLS observer rejection without a code is OTHER', async () => {
  const out = await fixture({ tls: false }).run();
  failed(out, 'TLS_VERIFICATION_FAILED'); diagnostic(out, 'OTHER', 'OTHER');
});
test('TLS observer thrown code is captured', async () => {
  const out = await fixture({ observe() { throw error('EPROTO'); } }).run();
  failed(out, 'UNEXPECTED_SANITIZED_FAILURE'); diagnostic(out, 'EPROTO', 'PROTOCOL_OR_HANDSHAKE');
});
for (const op of ['factory', 'begin', 'metadata', 'rollback', 'end']) {
  test('no TLS diagnostic outside connection: ' + op, async () => {
    diagnostic(await fixture({ hook(current) { if (current === op) throw error('CERT_HAS_EXPIRED'); } }).run());
  });
}
for (const code of ['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH',
  'ECONNREFUSED', 'EPIPE', '28P01', '28000', '57014']) {
  test('known non-TLS connect error has no TLS diagnostic: ' + code, async () => {
    diagnostic(await fixture({ hook(op) { if (op === 'connect') throw error(code); } }).run());
  });
}
test('success, invalid configuration and driver load failure have no TLS diagnostic', async () => {
  diagnostic(await fixture().run());
  diagnostic(await probeConnection('invalid'));
  diagnostic(await manualProbe([], { readEnvironment: () => URL_FIXTURE,
    loadClient() { throw error('CERT_HAS_EXPIRED'); } }));
});
test('deadline normalization retains existing failure and no synthetic TLS evidence', async () => {
  const f = fixture({ hook(op, state) {
    if (op === 'connect') { state.time = 5000; throw error('CERT_HAS_EXPIRED'); }
  } });
  const out = await f.run(); failed(out, 'CONNECTION_TIMEOUT'); diagnostic(out);
});

test('exact valid destination, one client/connect, literal three queries, rollback/close and exact schema', async () => {
  const f = fixture(), out = await f.run();
  assert.equal(out.PROBE_STATUS, 'PASS'); assert.equal(out.REAL_DEV_CONNECTIVITY_VERIFIED, 'YES');
  assert.deepEqual(Object.keys(out), KEYS);
  assert.ok(Object.values(out).filter(v => typeof v === 'boolean').every(Boolean));
  assert.equal(f.state.factories, 1); assert.deepEqual(f.state.calls, ['connect','begin','metadata','rollback','end']);
  assert.deepEqual(f.state.queries.map(q => q.text), SQL);
  assert.equal(f.state.options.host, HOST); assert.equal(f.state.options.user, 'postgres');
  assert.equal(f.state.options.port, 5432); assert.equal(f.state.options.database, 'postgres');
  assert.deepEqual(f.state.options.ssl, { rejectUnauthorized: true, servername: HOST });
  assert.equal(f.state.options.connectionTimeoutMillis, 5000);
  assert.equal(f.state.options.statement_timeout, 3000); assert.equal(f.state.options.query_timeout, 3000);
  assert.equal(f.state.options.idle_in_transaction_session_timeout, 10000);
});
for (const [name,url] of [
  ['pooler', 'postgresql://postgres.jdtqwryiyxeuoraecorw:synthetic-only@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'],
  ['production', URL_FIXTURE.replace('jdtqwryiyxeuoraecorw','paygtakajhvatwejygda')],
  ['malformed', 'invalid'], ['missing', undefined], ['query override', URL_FIXTURE+'?sslmode=disable'],
  ['alternate role', URL_FIXTURE.replace('://postgres:', '://reader:')], ['alternate host', URL_FIXTURE.replace(HOST,'example.test')],
]) test(name+' rejected before client construction', async () => {
  const f = fixture(); failed(await probeConnection(url, f.dependencies), 'CONFIGURATION_INVALID');
  assert.equal(f.state.factories, 0); assert.deepEqual(f.state.calls, []);
});
for (const [field,value,code] of [
  ['database_name','other','IDENTITY_MISMATCH'], ['current_role','other','IDENTITY_MISMATCH'],
  ['session_role','other','IDENTITY_MISMATCH'], ['read_only','off','READ_ONLY_GUARD_FAILED'],
  ['isolation','read committed','ISOLATION_GUARD_FAILED'],
]) test(field+' mismatch fails and rolls back', async () => {
  const f = fixture({ rows: [{ ...metadata(), [field]: value }] }); failed(await f.run(),code);
  assert.deepEqual(f.state.calls.slice(-2), ['rollback','end']);
});
for (const [name,rows] of [['zero',[]],['multiple',[metadata(),metadata()]],['null',[null]],['string',['bad']],['array',[[]]],['missing fields',[{}]]])
  test(name+' metadata rows fail closed', async () => failed(await fixture({ rows }).run(),'IDENTITY_MISMATCH'));
test('identity wins over read-only and isolation', async () => failed(await fixture({ rows: [{ database_name:'bad', read_only:'off', isolation:'bad' }] }).run(),'IDENTITY_MISMATCH'));
test('read-only wins over isolation', async () => failed(await fixture({ rows: [{ ...metadata(), read_only:'off', isolation:'bad' }] }).run(),'READ_ONLY_GUARD_FAILED'));
for (const tls of [false, undefined, null, 'true']) test('TLS observation must be exact true: '+String(tls), async () => {
  const f = fixture({ observe: () => tls }); failed(await f.run(),'TLS_VERIFICATION_FAILED');
  assert.deepEqual(f.state.calls,['connect','end']);
});
function socket(overrides = {}) { return { connection: { stream: { encrypted:true, authorized:true,
  authorizationError:null, servername:HOST, getPeerCertificate: () => ({ subjectaltname:'DNS:'+HOST }), ...overrides } } }; }
test('real TLS observer requires verified socket and matching peer hostname', () => assert.equal(observeTls(socket()),true));
for (const [name,change] of [['unencrypted',{encrypted:false}],['unauthorized',{authorized:false}],
  ['verification error',{authorizationError:'synthetic-only'}],['wrong SNI',{servername:'example.test'}],
  ['wrong certificate',{getPeerCertificate:()=>({subjectaltname:'DNS:example.test'})}],
  ['no certificate',{getPeerCertificate:()=>({})}],['throwing certificate',{getPeerCertificate:()=>{throw error();}}]])
  test('TLS observer rejects '+name, () => assert.equal(observeTls(socket(change)),false));
test('TLS observer rejects absent transport', () => assert.equal(observeTls({}),false));
for (const [code,expected] of [['ENETUNREACH','NETWORK_UNAVAILABLE'],['ECONNREFUSED','NETWORK_UNAVAILABLE'],
  ['28P01','AUTHENTICATION_FAILED'],['28000','AUTHENTICATION_FAILED'],
  ['CERT_HAS_EXPIRED','TLS_VERIFICATION_FAILED'],['ERR_TLS_CERT_ALTNAME_INVALID','TLS_VERIFICATION_FAILED'],
  ['UNKNOWN','UNEXPECTED_SANITIZED_FAILURE']]) test('structured connection error '+code+' sanitized, no retry', async () => {
  const f = fixture({hook(op){if(op==='connect') throw error(code);}});
  failed(await f.run(),expected); assert.equal(f.state.factories,1); assert.deepEqual(f.state.calls,['connect','end']);
});
test('server statement timeout sanitized', async () => failed(await fixture({hook(op){if(op==='metadata') throw error('57014');}}).run(),'QUERY_TIMEOUT'));
test('BEGIN uncertain acknowledgement still rolls back once', async () => {
  const f = fixture({hook(op){if(op==='begin') throw error();}}); failed(await f.run(),'UNEXPECTED_SANITIZED_FAILURE');
  assert.deepEqual(f.state.calls,['connect','begin','rollback','end']);
});
for (const ops of [['rollback'],['end'],['metadata','rollback'],['metadata','end'],['metadata','rollback','end']])
  test('cleanup precedence '+ops.join(','), async () => {
    const f = fixture({hook(op){if(ops.includes(op)) throw error();}});
    failed(await f.run(),ops.includes('end')?'CLIENT_CLOSE_FAILED':'ROLLBACK_FAILED');
    assert.equal(f.state.destroyed,1); assert.deepEqual(f.state.calls.slice(-2),['rollback','end']);
  });
for (const op of ['factory','connect','begin','metadata','rollback','end']) test('deadline at '+op+' prevents simulated verification', async () => {
  const f = fixture({hook(current,state){if(['rollback','end'].includes(op) && current==='factory') state.time=9500;if(current===op) state.time=10000;}});
  failed(await f.run(),'APPLICATION_DEADLINE_EXCEEDED');
  if(op==='factory') assert.ok(!f.state.calls.includes('connect'));
});
test('deadline before factory', async () => {
  let reads=0; const f=fixture({clock(){return ++reads===1?0:10000;}});
  failed(await f.run(),'APPLICATION_DEADLINE_EXCEEDED'); assert.equal(f.state.factories,0);
});
test('multiple operations cannot reset deadline and query budget shrinks', async () => {
  const f=fixture({hook(op,s){if(op==='factory')s.time=4000;if(op==='connect')s.time=7000;if(op==='begin')s.time=9000;if(op==='metadata')s.time=10000;}});
  failed(await f.run(),'APPLICATION_DEADLINE_EXCEEDED');
  assert.deepEqual(f.state.queries.slice(0,2).map(q=>q.query_timeout),[3000,1000]);
});
for(const [op,ms,code] of [['connect',5000,'CONNECTION_TIMEOUT'],['begin',3000,'QUERY_TIMEOUT'],
  ['metadata',3000,'QUERY_TIMEOUT'],['rollback',1000,'ROLLBACK_FAILED'],['end',2000,'CLIENT_CLOSE_FAILED']])
  test('pending '+op+' bounded at '+ms,async t=>{
    t.mock.timers.enable({apis:['setTimeout']}); let entered;const ready=new Promise(r=>entered=r);
    const f=fixture({hook(current){if(current===op){entered();return never();}}});const pending=f.run();
    await ready;f.state.time=ms;t.mock.timers.tick(ms);failed(await pending,code);
    assert.equal(f.state.calls.filter(c=>c==='end').length,1);
  });
test('overall deadline wins over simultaneous query timeout',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let entered;const ready=new Promise(r=>entered=r);
  const f=fixture({hook(op,s){if(op==='factory')s.time=9000;if(op==='metadata'){entered();return never();}}});
  const pending=f.run();await ready;f.state.time=10000;t.mock.timers.tick(1000);
  failed(await pending,'APPLICATION_DEADLINE_EXCEEDED');
});
test('12-second total envelope, rollback capped at 1s, cleanup shares 2s',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let meta,rollback,end;
  const m=new Promise(r=>meta=r),b=new Promise(r=>rollback=r),e=new Promise(r=>end=r);
  const f=fixture({hook(op,s){if(op==='factory')s.time=9000;
    if(op==='metadata'){meta();return never();}if(op==='rollback'){rollback();return never();}if(op==='end'){end();return never();}}});
  const pending=f.run();await m;f.state.time=10000;t.mock.timers.tick(1000);
  await b;assert.equal(f.state.queries.at(-1).query_timeout,1000);
  f.state.time=11000;t.mock.timers.tick(1000);await e;
  f.state.time=12000;t.mock.timers.tick(1000);failed(await pending,'CLIENT_CLOSE_FAILED');
  assert.equal(f.state.destroyed,1);assert.equal(f.state.time,12000);
});
test('late deadline detection cannot restart cleanup grace',async()=>{
  const f=fixture({hook(op,s){if(op==='begin')s.time=15000;}});
  failed(await f.run(),'CLIENT_CLOSE_FAILED');assert.equal(f.state.destroyed,1);
  assert.deepEqual(f.state.calls,['connect','begin','end']);
});
test('late query rejection consumed after timeout',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let entered,reject;
  const ready=new Promise(r=>entered=r);
  const f=fixture({hook(op){if(op==='metadata'){entered();return new Promise((_,r)=>reject=r);}}});
  const pending=f.run();await ready;f.state.time=3000;t.mock.timers.tick(3000);
  failed(await pending,'QUERY_TIMEOUT');reject(error());await Promise.resolve();
  assert.equal(f.state.calls.filter(c=>c==='rollback').length,1);
});
test('idle socket error cannot yield success',async()=>{
  const f=fixture({hook(op,s){if(op==='metadata')s.listener(error('ECONNRESET'));}});
  failed(await f.run(),'NETWORK_UNAVAILABLE');
});
test('no default database factory',async()=>failed(await probeConnection(URL_FIXTURE),'CONFIGURATION_INVALID'));
test('manual boundary reads only dedicated name and uses injected client',async()=>{
  const f=fixture(),names=[];
  const out=await manualProbe([],{...f.dependencies,readEnvironment(name){names.push(name);return URL_FIXTURE;},loadClient:async()=>f.dependencies.createClient});
  assert.equal(out.PROBE_STATUS,'PASS');assert.deepEqual(names,['TECHNICAL_BB_PHASE8_DEV_DATABASE_URL']);
});
test('missing dedicated config never loads driver or falls back',async()=>{
  let loads=0;const names=[];
  failed(await manualProbe([],{readEnvironment(name){names.push(name);return undefined;},loadClient:async()=>{loads++;}}),'CONFIGURATION_INVALID');
  assert.equal(loads,0);assert.deepEqual(names,['TECHNICAL_BB_PHASE8_DEV_DATABASE_URL']);
});
for(const args of [['--sql','SELECT 1'],['--host','example.test'],['--help']]) test('CLI rejects flags before environment access '+args[0],async()=>{
  failed(await manualProbe(args,{readEnvironment(){assert.fail();},loadClient(){assert.fail();}}),'CONFIGURATION_INVALID');
});
test('manual environment exception sanitized',async()=>failed(await manualProbe([],{readEnvironment(){throw error();},loadClient(){assert.fail();}}),'UNEXPECTED_SANITIZED_FAILURE'));
test('driver loading bounded before client construction',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let entered,time=0;const ready=new Promise(r=>entered=r);
  const pending=manualProbe([],{readEnvironment:()=>URL_FIXTURE,now:()=>time,loadClient(){entered();return never();}});
  await ready;time=10000;t.mock.timers.tick(10000);failed(await pending,'APPLICATION_DEADLINE_EXCEEDED');
});
test('budgets frozen',()=>assert.deepEqual(BUDGET,{connection:5000,statement:3000,application:10000,cleanup:2000,rollback:1000}));
test('safe fresh import: blocked networking, targeted env trap, no output, no main',()=>{
  const url=new URL('../scripts/probe-bollinger-shadow-dev-connection.mjs',import.meta.url).href;
  const code=`import net from 'node:net';import tls from 'node:tls';import dns from 'node:dns';import {syncBuiltinESMExports} from 'node:module';
    const blocked=()=>{throw new Error('network forbidden')};
    net.Socket.prototype.connect=blocked;net.connect=blocked;tls.connect=blocked;dns.lookup=blocked;globalThis.fetch=blocked;
    syncBuiltinESMExports();const env=process.env;process.env=new Proxy(env,{get(t,k){if(String(k).includes('DATABASE_URL'))throw new Error('env forbidden');return t[k];}});
    await import(${JSON.stringify(url)});`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{},encoding:'utf8',timeout:10000});
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'');
});
test('source capability surface has no acquisition/evaluator/provider calls or generic fallback',async()=>{
  const src=await readFile(new URL('../scripts/probe-bollinger-shadow-dev-connection.mjs',import.meta.url),'utf8');
  assert.ok(!/evaluateDevReadonly|evaluateBollingerShadow|technical_bb_observation_|fetch\(|new Pool|\.retry|COMMIT|process\.env\.DATABASE_URL/.test(src));
  assert.equal((src.match(/client\.connect\(/g)||[]).length,1);
  assert.equal((src.match(/new Client\(/g)||[]).length,1);
  assert.match(src,/import \{ validateDestination \} from '\.\/evaluate-bollinger-shadow-dev-readonly\.mjs'/);
  assert.match(src,/setDefaultAutoSelectFamily\(false\)/);
});



test('no evaluator invocation measured with in-process V8 coverage',async()=>{
  const {Session}=await import('node:inspector/promises');const session=new Session();session.connect();
  try {
    await session.post('Profiler.enable');await session.post('Profiler.startPreciseCoverage',{callCount:true,detailed:false});
    await fixture().run();
    const {canonicalPhase8Json}=await import('../app/lib/technicalObservation/bollingerShadowEvaluation.ts');canonicalPhase8Json(null);
    const {result}=await session.post('Profiler.takePreciseCoverage');
    for(const suffix of ['/bollingerShadowEvaluation.ts','/evaluate-bollinger-shadow-dev-readonly.mjs']) {
      const script=result.find(s=>s.url.endsWith(suffix));assert.ok(script, 'authoritative module must be in coverage');assert.ok(script.functions.some(fn=>['canonicalPhase8Json','validateDestination'].includes(fn.functionName) && fn.ranges.some(r=>r.count>0)), 'pure positive control must be measured');
      for(const fn of script?.functions||[]) if(['evaluateBollingerShadow','evaluateDevReadonly','main'].includes(fn.functionName))
        assert.ok(fn.ranges.every(r=>r.count===0));
    }
  } finally {await session.post('Profiler.stopPreciseCoverage');await session.post('Profiler.disable');session.disconnect();}
});
test('deadline during metadata interpretation prevents success',async()=>{
  const row=metadata(),f=fixture({rows:[row]});
  Object.defineProperty(row,'isolation',{get(){f.state.time=10000;return 'repeatable read';}});
  failed(await f.run(),'APPLICATION_DEADLINE_EXCEEDED');
});
test('factory failure is sanitized and never connects',async()=>{
  failed(await probeConnection(URL_FIXTURE,{createClient(){throw error();}}),'UNEXPECTED_SANITIZED_FAILURE');
});
test('rollback acknowledgement must be ROLLBACK',async()=>{
  const f=fixture(),query=f.client.query.bind(f.client);
  f.client.query=async q=>{const r=await query(q);return q.text===SQL[2]?{command:'OTHER'}:r;};
  failed(await f.run(),'ROLLBACK_FAILED');assert.equal(f.state.destroyed,1);
});
test('late successful close beyond shared grace is failure',async()=>{
  const f=fixture({hook(op,s){if(op==='end')s.time=2000;}});
  failed(await f.run(),'CLIENT_CLOSE_FAILED');
});
test('all failed evidence starts false on invalid configuration',async()=>{
  const out=await probeConnection('invalid');failed(out,'CONFIGURATION_INVALID');
  assert.ok(Object.values(out).filter(v=>typeof v==='boolean').every(v=>v===false));
});




// Control monotonic time independently of timers to force either race winner.
for (const [op, budget, timeout] of [
  ['connect', 5000, 'CONNECTION_TIMEOUT'], ['begin', 3000, 'QUERY_TIMEOUT'],
  ['metadata', 3000, 'QUERY_TIMEOUT'],
]) {
  for (const [driverCode, expected] of [
    [undefined, 'UNEXPECTED_SANITIZED_FAILURE'], ['28P01', 'AUTHENTICATION_FAILED'],
    ['CERT_HAS_EXPIRED', 'TLS_VERIFICATION_FAILED'], ['ECONNRESET', 'NETWORK_UNAVAILABLE'],
  ]) test(op + ' rejection just before deadline preserves ' + expected, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = fixture({ hook(current, s) {
      if (current === op) { s.time = budget - 1; throw error(driverCode); }
    } });
    failed(await f.run(), expected);
    assert.equal(f.state.calls.filter(c => c === 'end').length, 1);
    assert.equal(f.state.calls.filter(c => c === 'rollback').length, op === 'connect' ? 0 : 1);
  });
  for (const at of [budget, budget + 1, 10000]) {
    for (const winner of ['driver', 'timer']) {
      for (const driverCode of [undefined, '28P01']) {
        test(op + ' rejection at ' + at + ', ' + winner + ' first, code ' + driverCode, async t => {
          t.mock.timers.enable({ apis: ['setTimeout'] });
          let entered, rejectDriver;
          const ready = new Promise(resolve => { entered = resolve; });
          const f = fixture({ hook(current) {
            if (current === op) {
              entered();
              return new Promise((_, reject) => { rejectDriver = reject; });
            }
          } });
          const pending = f.run();
          await ready;
          f.state.time = at;
          if (winner === 'driver') rejectDriver(error(driverCode));
          else t.mock.timers.tick(at);
          const out = await pending;
          // Settle the loser after output to guarantee which side won the race.
          if (winner === 'timer') rejectDriver(error(driverCode));
          else t.mock.timers.tick(at);
          await Promise.resolve();
          failed(out, at >= 10000 ? 'APPLICATION_DEADLINE_EXCEEDED' : timeout);
          assert.equal(f.state.calls.filter(c => c === 'connect').length, 1);
          assert.equal(f.state.calls.filter(c => c === 'rollback').length, op === 'connect' ? 0 : 1);
          assert.equal(f.state.calls.filter(c => c === 'end').length, 1);
          assert.equal(f.state.destroyed, 0);
        });
      }
    }
  }
}
for (const ops of [['rollback'], ['end'], ['rollback', 'end']]) {
  test('deadline rejection retains cleanup precedence: ' + ops.join(','), async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = fixture({ hook(op, s) {
      if (op === 'metadata') { s.time = 3000; throw error(); }
      if (ops.includes(op)) throw error();
    } });
    failed(await f.run(), ops.includes('end') ? 'CLIENT_CLOSE_FAILED' : 'ROLLBACK_FAILED');
    assert.deepEqual(f.state.calls, ['connect', 'begin', 'metadata', 'rollback', 'end']);
    assert.equal(f.state.destroyed, 1);
  });
}

for (const [code, label] of [
  ['28P01', 'PASSWORD_AUTH_REJECTED'],
  ['28000', 'INVALID_AUTHORIZATION_SPECIFICATION'],
]) {
  for (const delivery of ['rejection', 'socket']) test('auth diagnostic ' + code + ' via ' + delivery, async () => {
    const injected = { code };
    for (const key of ['message', 'stack', 'hostname', 'cause', 'detail', 'hint', 'password', 'connectionString']) {
      Object.defineProperty(injected, key, { get() { assert.fail('forbidden error property'); } });
    }
    const f = fixture({ hook(op, state) {
      if (op === 'connect') {
        if (delivery === 'socket') state.listener(injected);
        else throw injected;
      }
    } });
    const out = await f.run();
    failed(out, 'AUTHENTICATION_FAILED'); diagnostic(out);
    assert.equal(out.SANITIZED_AUTH_ERROR_CODE, label);
    assert.equal(out.CONNECTION_ESTABLISHED, false);
    assert.equal(out.CLIENT_CLOSED, true);
    assert.deepEqual(f.state.calls, ['connect', 'end']);
    assert.ok(!JSON.stringify(out).includes(code));
  });
  test('auth diagnostic survives close failure ' + code, async () => {
    const f = fixture({ hook(op) {
      if (op === 'connect') throw { code };
      if (op === 'end') throw error();
    } });
    const out = await f.run();
    failed(out, 'CLIENT_CLOSE_FAILED'); diagnostic(out);
    assert.equal(out.SANITIZED_AUTH_ERROR_CODE, label);
    assert.equal(out.CLIENT_CLOSED, false);
  });
}

test('auth diagnostic defaults on success and invalid configuration', async () => {
  for (const out of [await fixture().run(), await probeConnection('invalid')]) {
    assert.equal(out.SANITIZED_AUTH_ERROR_CODE, 'NOT_AVAILABLE');
  }
});
for (const code of [undefined, 'PRIVATE_AUTH_SENTINEL', 28000, 'ECONNRESET',
  { toString() { assert.fail('no coercion'); }, valueOf() { assert.fail('no coercion'); } }]) {
  test('auth diagnostic rejects unrelated code ' + typeof code, async () => {
    const out = await fixture({ hook(op) { if (op === 'connect') throw { code }; } }).run();
    assert.equal(out.SANITIZED_AUTH_ERROR_CODE, 'NOT_AVAILABLE');
    assert.ok(!JSON.stringify(out).includes('PRIVATE_AUTH_SENTINEL'));
  });
}
for (const op of ['factory', 'begin', 'metadata', 'rollback', 'end']) {
  test('auth diagnostic unavailable outside connection ' + op, async () => {
    const out = await fixture({ hook(current) { if (current === op) throw { code: '28P01' }; } }).run();
    assert.equal(out.SANITIZED_AUTH_ERROR_CODE, 'NOT_AVAILABLE');
  });
}
