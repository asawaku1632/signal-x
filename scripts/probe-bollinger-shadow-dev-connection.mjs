import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { checkServerIdentity } from 'node:tls';
import { validateDestination } from './evaluate-bollinger-shadow-dev-readonly.mjs';

// Manual connection-only probe. Importing never reads environment or loads pg.
// Timers bound async waits to 12 seconds, not OS/process execution time.
export const BUDGET = Object.freeze({ connection: 5000, statement: 3000,
  application: 10000, cleanup: 2000, rollback: 1000 });
const BEGIN = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;';
const META = `SELECT
  current_database() AS database_name,
  current_user AS current_role,
  session_user AS session_role,
  current_setting('transaction_read_only') AS read_only,
  current_setting('transaction_isolation') AS isolation;`;
const ROLLBACK = 'ROLLBACK;';
const HOST = 'db.jdtqwryiyxeuoraecorw.supabase.co';
const ENV = 'TECHNICAL_BB_PHASE8_DEV_DATABASE_URL';
class Failure extends Error { constructor(code) { super(code); this.code = code; } }
const fail = (code) => { throw new Failure(code); };
function report() {
  return { PROBE_STATUS: 'FAIL', CONNECTION_ESTABLISHED: false, TLS_VERIFIED: false,
    EXPECTED_HOST_MATCH: false, EXPECTED_DATABASE_MATCH: false, EXPECTED_ROLE_MATCH: false,
    TRANSACTION_READ_ONLY: false, ISOLATION_REPEATABLE_READ: false,
    ROLLBACK_COMPLETE: false, CLIENT_CLOSED: false, FAILURE_CLASS: null,
    REAL_DEV_CONNECTIVITY_VERIFIED: 'NO' };
}
function classify(error) {
  if (error instanceof Failure) return error.code;
  const code = error?.code;
  if (['ENOTFOUND','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','ECONNREFUSED','ECONNRESET','EPIPE'].includes(code)) return 'NETWORK_UNAVAILABLE';
  if (['28P01','28000'].includes(code)) return 'AUTHENTICATION_FAILED';
  if (['ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','CERT_NOT_YET_VALID','DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(code)) return 'TLS_VERIFICATION_FAILED';
  if (code === '57014') return 'QUERY_TIMEOUT';
  return 'UNEXPECTED_SANITIZED_FAILURE';
}
// No injectable boolean can certify the real CLI: it uses this observer directly.
export function observeTls(client) {
  try {
    const socket = client.connection?.stream;
    return socket?.encrypted === true && socket.authorized === true
      && !socket.authorizationError && socket.servername === HOST
      && checkServerIdentity(HOST, socket.getPeerCertificate(true)) === undefined;
  } catch { return false; }
}

// Trusted dependency injection only; there is deliberately no default DB client.
export async function probeConnection(databaseUrl, { createClient, observe = observeTls,
  now = () => performance.now(), loadClient } = {}) {
  const out = report(), deadline = now() + BUDGET.application;
  let client, began = false, primary = null, socketError = null;
  let rollbackFailed = false, closeFailed = false;
  const check = () => {
    if (now() >= deadline) fail('APPLICATION_DEADLINE_EXCEEDED');
    if (socketError) throw socketError;
  };
  async function wait(action, end, code, primaryOperation = false) {
    let timer;
    const checkWait = () => {
      if (primaryOperation) check();
      if (now() >= end) fail(code);
    };
    try {
      checkWait();
      const value = await Promise.race([
        Promise.resolve().then(() => { checkWait(); return action(); }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Failure(
          primaryOperation && now() >= deadline ? 'APPLICATION_DEADLINE_EXCEEDED' : code)),
        Math.max(1, Math.ceil(end - now()))); }),
      ]);
      checkWait(); return value;
    } catch (error) {
      if (primaryOperation) {
        // Normalize rejected operations by observed deadlines, regardless of race winner.
        const observed = now();
        if (observed >= deadline) fail('APPLICATION_DEADLINE_EXCEEDED');
        if (observed >= end) fail(code);
      }
      throw error;
    } finally { clearTimeout(timer); }
  }
  try {
    let options;
    try { options = validateDestination(databaseUrl); }
    catch { fail('CONFIGURATION_INVALID'); }
    check();
    options.connectionTimeoutMillis = Math.min(BUDGET.connection, Math.ceil(deadline - now()));
    options.statement_timeout = BUDGET.statement;
    options.query_timeout = BUDGET.statement;
    options.idle_in_transaction_session_timeout = BUDGET.application;
    if (loadClient) createClient = await wait(loadClient, deadline, 'APPLICATION_DEADLINE_EXCEEDED', true);
    check();
    if (typeof createClient !== 'function') fail('CONFIGURATION_INVALID');
    client = createClient(options);
    client.on('error', (error) => { socketError = error || new Failure('UNEXPECTED_SANITIZED_FAILURE'); });
    check();
    await wait(() => client.connect(), Math.min(deadline, now() + BUDGET.connection), 'CONNECTION_TIMEOUT', true);
    out.CONNECTION_ESTABLISHED = true;
    if (observe(client) !== true) fail('TLS_VERIFICATION_FAILED');
    out.TLS_VERIFIED = true; out.EXPECTED_HOST_MATCH = true;
    const query = (text, before = () => {}) => {
      const end = Math.min(deadline, now() + BUDGET.statement);
      return wait(() => { before(); return client.query({ text, query_timeout: Math.max(1, Math.ceil(end - now())) }); }, end, 'QUERY_TIMEOUT', true);
    };
    await query(BEGIN, () => { began = true; });
    const result = await query(META);
    if (!Array.isArray(result?.rows) || result.rows.length !== 1 || !result.rows[0]
      || typeof result.rows[0] !== 'object' || Array.isArray(result.rows[0])) fail('IDENTITY_MISMATCH');
    const row = result.rows[0];
    out.EXPECTED_DATABASE_MATCH = row.database_name === 'postgres';
    out.EXPECTED_ROLE_MATCH = row.current_role === 'postgres' && row.session_role === 'postgres';
    out.TRANSACTION_READ_ONLY = row.read_only === 'on';
    out.ISOLATION_REPEATABLE_READ = row.isolation === 'repeatable read';
    if (!out.EXPECTED_DATABASE_MATCH || !out.EXPECTED_ROLE_MATCH) fail('IDENTITY_MISMATCH');
    if (!out.TRANSACTION_READ_ONLY) fail('READ_ONLY_GUARD_FAILED');
    if (!out.ISOLATION_REPEATABLE_READ) fail('ISOLATION_GUARD_FAILED');
    check();
  } catch (error) { primary = now() >= deadline ? 'APPLICATION_DEADLINE_EXCEEDED' : classify(error); }
  finally {
    if (client) {
      const cleanupEnd = Math.min(now(), deadline) + BUDGET.cleanup;
      if (began) {
        try {
          const end = Math.min(cleanupEnd, now() + BUDGET.rollback);
          const result = await wait(() => client.query({ text: ROLLBACK,
            query_timeout: Math.max(1, Math.ceil(end - now())) }), end, 'ROLLBACK_FAILED');
          if (result?.command !== 'ROLLBACK') fail('ROLLBACK_FAILED');
          out.ROLLBACK_COMPLETE = true;
        } catch { rollbackFailed = true; }
      }
      try {
        // Always invoke end once, even when no grace remains; consume late rejection.
        const ending = Promise.resolve(client.end()); ending.catch(() => {});
        await wait(() => ending, cleanupEnd, 'CLIENT_CLOSE_FAILED');
        out.CLIENT_CLOSED = true;
      } catch { closeFailed = true; }
      if (rollbackFailed || closeFailed) {
        try { client.connection?.stream?.destroy(); } catch { /* no raw errors */ }
      }
    }
  }
  if (!primary && now() >= deadline) primary = 'APPLICATION_DEADLINE_EXCEEDED';
  if (!primary && socketError) primary = classify(socketError);
  out.FAILURE_CLASS = closeFailed ? 'CLIENT_CLOSE_FAILED' : rollbackFailed ? 'ROLLBACK_FAILED' : primary;
  if (!out.FAILURE_CLASS && Object.entries(out).filter(([, v]) => typeof v === 'boolean').every(([, v]) => v)) {
    out.PROBE_STATUS = 'PASS'; out.REAL_DEV_CONNECTIVITY_VERIFIED = 'YES';
  } else if (!out.FAILURE_CLASS) out.FAILURE_CLASS = 'UNEXPECTED_SANITIZED_FAILURE';
  return out;
}

// Injected environment/loader required: tests never inherit a real environment.
export async function manualProbe(args, { readEnvironment, loadClient, ...dependencies } = {}) {
  if (args.length !== 0 || typeof readEnvironment !== 'function' || typeof loadClient !== 'function') {
    return { ...report(), FAILURE_CLASS: 'CONFIGURATION_INVALID' };
  }
  try { return await probeConnection(readEnvironment(ENV), { ...dependencies, loadClient }); }
  catch { return { ...report(), FAILURE_CLASS: 'UNEXPECTED_SANITIZED_FAILURE' }; }
}
async function main() {
  const result = await manualProbe(process.argv.slice(2), {
    readEnvironment: (name) => process.env[name],
    loadClient: async () => {
      const { setDefaultAutoSelectFamily } = await import('node:net');
      setDefaultAutoSelectFamily(false); // one address attempt in this manual process
      const { default: Client } = await import('pg/lib/client.js');
      return (options) => new Client(options);
    },
  });
  process.stdout.write(JSON.stringify(result) + '\n');
  if (result.PROBE_STATUS !== 'PASS') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
