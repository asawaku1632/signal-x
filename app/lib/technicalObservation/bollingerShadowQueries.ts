import { ACTIVE_STOCKS } from "../activeStockList.ts";
export const PHASE7_CODES = Object.freeze(ACTIVE_STOCKS.slice(0, 20).map(stock => String(stock.code)));
// Result follow-up must include previously saved Phase7 shadow observations outside the observation-only 20 stock batch.
// STEP327E: 3762 was manually observed and must be tracked without widening OBSERVATION writes.
export const PHASE7_RESULT_CODES = Object.freeze(
  PHASE7_CODES.includes("3762") ? [...PHASE7_CODES] : [...PHASE7_CODES, "3762"]);
export const PHASE7_PENDING_SQL = `SELECT e.id event_id,e.snapshot_id,e.side,e.sigma_level,e.event_type,s.code,s.timeframe,s.close,
            s.observation_date,s.bar_end_at,
            COALESCE(s.timeframe='1D' AND s.detector_version='BB_OBSERVATION_V1'
              AND s.provider='YAHOO_CHART' AND s.timezone='Asia/Tokyo'
              AND s.metadata->'shadowOnly'='true'::jsonb AND s.metadata->'phase'='"7"'::jsonb
              AND s.metadata->'executionSource'='"PHASE_7_SHADOW_AUTOMATION"'::jsonb, FALSE) AS phase7_provenance
       FROM technical_bb_observation_events e
       JOIN technical_bb_observation_snapshots s ON s.id=e.snapshot_id
      WHERE s.timeframe='1D' AND s.detector_version='BB_OBSERVATION_V1'
        AND ($2::boolean=FALSE OR s.code=ANY($3::text[]))
        AND ($2::boolean=FALSE OR COALESCE(s.provider='YAHOO_CHART' AND s.timezone='Asia/Tokyo'
          AND s.metadata->'shadowOnly'='true'::jsonb AND s.metadata->'phase'='"7"'::jsonb
          AND s.metadata->'executionSource'='"PHASE_7_SHADOW_AUTOMATION"'::jsonb, FALSE))
        AND EXISTS (SELECT 1 FROM unnest(ARRAY[1,3,5]) h
          WHERE NOT EXISTS (SELECT 1 FROM technical_bb_observation_results r
            WHERE r.event_id=e.id AND r.horizon=h AND r.horizon_unit='TRADING_DAY'
              AND r.result_version='BB_OBSERVATION_RESULT_V1' AND r.result_quality='COMPLETE'))
      ORDER BY s.observation_date,e.id LIMIT $1`;
export const PHASE7_PARENT_SQL = `SELECT e.id event_id,e.snapshot_id,e.side,e.sigma_level,e.event_type,
                  s.code,s.timeframe,s.close,s.observation_date,s.bar_end_at FROM technical_bb_observation_events e
                JOIN technical_bb_observation_snapshots s ON s.id=e.snapshot_id
                WHERE e.id=$1 AND s.timeframe='1D' AND s.detector_version='BB_OBSERVATION_V1'
                  AND s.provider='YAHOO_CHART' AND s.timezone='Asia/Tokyo'
                  AND s.metadata->'shadowOnly'='true'::jsonb AND s.metadata->'phase'='"7"'::jsonb
                  AND s.metadata->'executionSource'='"PHASE_7_SHADOW_AUTOMATION"'::jsonb
                FOR SHARE OF e,s`;
export const PHASE7_OWN_LOCK_PRESENT_SQL = "SELECT EXISTS(SELECT 1 FROM public.cron_execution_locks WHERE lock_key=$1 AND owner_id=$2) AS present";
// Database-enforced proof for real DEV runtime only (offline fixtures are unchanged).
// The running role must be login-capable, non-privileged, a non-owner, and protected by RLS.
export const PHASE7_ROLE_PROOF_SQL = `SELECT r.rolcanlogin, r.rolsuper, r.rolbypassrls, r.rolcreatedb,
  r.rolcreaterole, r.rolreplication,
  (SELECT count(*)::int FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname IN
    ('cron_execution_locks', 'technical_bb_observation_snapshots',
     'technical_bb_observation_events', 'technical_bb_observation_results')) AS phase7_table_count,
  (SELECT count(*)::int FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname IN
    ('cron_execution_locks', 'technical_bb_observation_snapshots',
     'technical_bb_observation_events', 'technical_bb_observation_results')
     AND c.relrowsecurity) AS phase7_rls_count,
  (SELECT count(*)::int FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname IN
    ('cron_execution_locks', 'technical_bb_observation_snapshots',
     'technical_bb_observation_events', 'technical_bb_observation_results')
     AND pg_catalog.pg_has_role(session_user, c.relowner, 'MEMBER')) AS phase7_owner_memberships,
  (SELECT count(*)::int FROM pg_catalog.pg_roles elevated
    WHERE elevated.rolname IN ('pg_read_all_data','pg_write_all_data')
      AND pg_catalog.pg_has_role(session_user, elevated.oid, 'MEMBER')) AS broad_data_memberships
  FROM pg_catalog.pg_roles r WHERE r.rolname = session_user`;
export const PHASE7_READ_SQL = Object.freeze([
"SELECT current_database() AS database_name, current_user AS current_role, session_user AS session_role",
"SELECT EXISTS(SELECT 1 FROM public.cron_execution_locks WHERE lock_key=$1) AS present",
`SELECT count(*)::int count FROM (SELECT event_id,horizon,horizon_unit,result_version
    FROM technical_bb_observation_results GROUP BY event_id,horizon,horizon_unit,result_version HAVING count(*)>1)x`,
`SELECT count(*)::int count FROM technical_bb_observation_results r
    LEFT JOIN technical_bb_observation_events e ON e.id=r.event_id WHERE e.id IS NULL`, PHASE7_PENDING_SQL,
...["technical_bb_observation_snapshots", "technical_bb_observation_events", "technical_bb_observation_results"].map(table => `SELECT COUNT(*)::int AS count,
      md5(COALESCE(string_agg(row_to_json(t)::text, '|' ORDER BY t.id), '')) AS digest
      FROM public.${table} t`), PHASE7_OWN_LOCK_PRESENT_SQL,
  PHASE7_ROLE_PROOF_SQL,
]);

export const SNAPSHOT_COLUMNS = Object.freeze([
  "code", "observation_date", "timeframe", "close", "bb_period", "bb_middle",
  "standard_deviation", "bb_upper_1", "bb_upper_2", "bb_upper_3", "bb_lower_1",
  "bb_lower_2", "bb_lower_3", "bb_sigma_position", "detector_version", "provider",
  "provider_timestamp", "bar_start_at", "bar_end_at", "timezone", "rsi14", "macd",
  "macd_signal", "macd_histogram", "macd_cross", "ema20", "ema75", "ema200", "atr14",
  "volume_ratio_20", "rsi_availability", "macd_availability", "ema_availability",
  "atr_availability", "volume_ratio_availability", "metadata",
] as const);
export const PHASE7_SNAPSHOT_SELECT_SQL = `SELECT id, ${SNAPSHOT_COLUMNS.join(", ")} FROM technical_bb_observation_snapshots
       WHERE code=$1 AND timeframe=$2 AND bar_end_at=$3 AND detector_version=$4 FOR UPDATE`;
export const PHASE7_SNAPSHOT_INSERT_SQL = `INSERT INTO technical_bb_observation_snapshots (${SNAPSHOT_COLUMNS.join(", ")})
         VALUES (${SNAPSHOT_COLUMNS.map((_, index) => `$${index + 1}${index === SNAPSHOT_COLUMNS.length - 1 ? "::jsonb" : ""}`).join(", ")})
         ON CONFLICT ON CONSTRAINT technical_bb_observation_snapshots_idempotency_key DO NOTHING
         RETURNING id`;
export const PHASE7_EVENT_INSERT_SQL = `INSERT INTO technical_bb_observation_events (snapshot_id,side,sigma_level,event_type)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ON CONSTRAINT technical_bb_observation_events_idempotency_key DO NOTHING`;

export const RESULT_COLUMNS = Object.freeze([
  "event_id", "horizon", "horizon_unit", "entry_price", "future_close", "return_percent",
  "max_rise_percent", "max_drawdown_percent", "max_rise_trade_date",
  "max_drawdown_trade_date", "evaluated_trade_date", "window_candle_count", "result_quality",
  "result_version",
] as const);
export const PHASE7_RESULT_SELECT_SQL = `SELECT id, ${RESULT_COLUMNS.join(", ")} FROM technical_bb_observation_results
         WHERE event_id=$1 AND horizon=$2 AND horizon_unit=$3 AND result_version=$4 FOR UPDATE`;
export const PHASE7_RESULT_INSERT_SQL = `INSERT INTO technical_bb_observation_results (${RESULT_COLUMNS.join(", ")}, evaluated_at)
         VALUES (${RESULT_COLUMNS.map((_, index) => `$${index + 1}`).join(", ")}, $${RESULT_COLUMNS.length + 1})
         ON CONFLICT ON CONSTRAINT technical_bb_observation_results_idempotency_key DO NOTHING
         RETURNING id`;

export const PHASE7_ACQUIRE_LOCK_SQL = `INSERT INTO cron_execution_locks (lock_key,owner_id,acquired_at,expires_at)
    VALUES ($1,$2,NOW(),NOW()+($3*INTERVAL '1 second')) ON CONFLICT(lock_key) DO UPDATE SET
    owner_id=EXCLUDED.owner_id,acquired_at=EXCLUDED.acquired_at,expires_at=EXCLUDED.expires_at
    WHERE cron_execution_locks.expires_at<=NOW() RETURNING lock_key`;
export const PHASE7_RELEASE_LOCK_SQL = "DELETE FROM cron_execution_locks WHERE lock_key=$1 AND owner_id=$2";
// Acquires a row lock until COMMIT/ROLLBACK; takeover UPDATE/DELETE must wait for the writer.
// clock_timestamp() is used rather than transaction-start NOW() to check the live lease.
export const PHASE7_FENCE_LOCK_SQL = "SELECT lock_key FROM public.cron_execution_locks WHERE lock_key=$1 AND owner_id=$2 AND expires_at > clock_timestamp() FOR UPDATE";

// STEP 318: capability-gated SQL. Real DEV sessions MUST NOT use the legacy DML lock SQL.
// Secrets are bound as parameters, never interpolated into SQL or returned to a caller.
export const PHASE7_CAP_ACQUIRE_SQL = "SELECT phase7_guard.acquire($1,$2,$3,$4) AS acquired";
export const PHASE7_CAP_RELEASE_SQL = "SELECT phase7_guard.release($1,$2,$3) AS released";
export const PHASE7_CAP_FENCE_SQL = "SELECT phase7_guard.fence($1,$2,$3) AS fenced";
export const PHASE7_CAP_BIND_SQL = "SELECT set_config('phase7.capability',$1,true) IS NOT NULL AS bound";
// Executed before any live lock acquisition. Missing or elevated privileges fail closed.
export const PHASE7_CAP_ROLE_READY_SQL = `SELECT
  (SELECT count(*)::int FROM pg_catalog.pg_proc p
     JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='phase7_guard' AND p.proname IN ('acquire','release','fence','has_capability')) AS capability_functions,
  (SELECT count(*)::int FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND policyname IN
     ('p7_317_snap_capability_insert','p7_317_event_capability_insert','p7_317_result_capability_insert')
     AND permissive='RESTRICTIVE') AS restrictive_insert_policies,
  pg_catalog.has_table_privilege(current_user,'public.cron_execution_locks','INSERT') AS direct_lock_insert,
  pg_catalog.has_table_privilege(current_user,'public.cron_execution_locks','UPDATE') AS direct_lock_update,
  pg_catalog.has_table_privilege(current_user,'public.cron_execution_locks','DELETE') AS direct_lock_delete,
  pg_catalog.has_schema_privilege(current_user,'phase7_guard','USAGE') AS cap_schema_usage`;

export const PHASE7_BEGIN_SQL = "BEGIN";
export const PHASE7_COMMIT_SQL = "COMMIT";
export const PHASE7_ROLLBACK_SQL = "ROLLBACK";

// The registry is private: callers cannot add SQL or replace validators.
type Registration = Readonly<{ kind: "READ" | "PERSISTENCE" | "ACQUIRE_LOCK" | "RELEASE_LOCK" | "LOCK_FENCE" | "CAP_ACQUIRE" | "CAP_RELEASE" | "CAP_FENCE" | "CAP_BIND" | "TRANSACTION";
  command: string; validate: (values: unknown[]) => boolean }>;
const registry = new Map<string, Registration>();
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const id = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const timestamp = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const code = (v: unknown) => typeof v === "string" && PHASE7_CODES.includes(v);
const lockKey = (v: unknown) => v === "signalx-technical-bb-shadow-observation" || v === "signalx-technical-bb-shadow-results";
const owner = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
function register(sql: string, kind: Registration["kind"], command: string, validate: Registration["validate"]) {
  if (registry.has(sql)) throw new Error("DUPLICATE_PHASE7_SQL");
  registry.set(sql, Object.freeze({ kind, command, validate }));
}
for (const sql of PHASE7_READ_SQL) register(sql, "READ", "SELECT", sql === PHASE7_PENDING_SQL
  ? v => v.length === 3 && id(v[0]) && Number(v[0]) <= 100 && v[1] === true
    && Array.isArray(v[2]) && v[2].length === PHASE7_RESULT_CODES.length && PHASE7_RESULT_CODES.every((c, i) => (v[2] as unknown[])[i] === c)
  : sql === PHASE7_OWN_LOCK_PRESENT_SQL ? v => v.length === 2 && lockKey(v[0]) && owner(v[1])
  : sql === PHASE7_READ_SQL[1] ? v => v.length === 1 && lockKey(v[0]) : v => v.length === 0);
register(PHASE7_PARENT_SQL, "READ", "SELECT", v => v.length === 1 && id(v[0]));
register(PHASE7_SNAPSHOT_SELECT_SQL, "READ", "SELECT", v => v.length === 4 && code(v[0]) && v[1] === "1D"
  && timestamp(v[2]) && v[3] === "BB_OBSERVATION_V1");
register(PHASE7_RESULT_SELECT_SQL, "READ", "SELECT", v => v.length === 4 && id(v[0]) && [1,3,5].includes(Number(v[1]))
  && typeof v[1] === "number" && v[2] === "TRADING_DAY" && v[3] === "BB_OBSERVATION_RESULT_V1");
register(PHASE7_SNAPSHOT_INSERT_SQL, "PERSISTENCE", "INSERT", v => {
  if (v.length !== SNAPSHOT_COLUMNS.length || !code(v[0]) || !date(v[1]) || v[2] !== "1D"
    || !v.slice(3,14).every(finite) || Number(v[3]) <= 0 || v[4] !== 20 || Number(v[6]) <= 0
    || v[14] !== "BB_OBSERVATION_V1" || v[15] !== "YAHOO_CHART" || v[19] !== "Asia/Tokyo"
    || !(v[16] === null || timestamp(v[16])) || !timestamp(v[17]) || !timestamp(v[18])
    || String(v[17]) >= String(v[18]) || ![...v.slice(20,24), ...v.slice(25,30)].every(x => x === null || finite(x))
    || ![null,"GOLDEN_CROSS","DEAD_CROSS"].includes(v[24] as string | null)
    || !v.slice(30,35).every(x => ["AVAILABLE","UNAVAILABLE","INSUFFICIENT_HISTORY","INVALID"].includes(String(x)) && typeof x === "string")
    || typeof v[35] !== "string") return false;
  const indicators = [[30, [20]], [31, [21,22,23]], [32, [25,26,27]], [33, [28]], [34, [29]]] as const;
  if (indicators.some(([availability, indices]) => v[availability] === "AVAILABLE" && !indices.every(i => finite(v[i])))
    || v[24] !== null && v[31] !== "AVAILABLE") return false;
  try { const m = JSON.parse(v[35]); return m !== null && typeof m === "object" && !Array.isArray(m)
    && m.shadowOnly === true && m.phase === "7" && m.executionSource === "PHASE_7_SHADOW_AUTOMATION";
  } catch { return false; }
});
register(PHASE7_EVENT_INSERT_SQL, "PERSISTENCE", "INSERT", v => v.length === 4 && id(v[0])
  && ["LOWER","UPPER"].includes(v[1] as string) && [2,3].includes(v[2] as number)
  && ["TOUCH","CROSS","CONTINUATION","RETURN_INSIDE"].includes(v[3] as string));
register(PHASE7_RESULT_INSERT_SQL, "PERSISTENCE", "INSERT", v => v.length === RESULT_COLUMNS.length + 1 && id(v[0])
  && [1,3,5].includes(v[1] as number) && v[2] === "TRADING_DAY" && v.slice(3,8).every(finite)
  && Number(v[3]) > 0 && Number(v[4]) > 0 && v.slice(8,11).every(date) && v[11] === v[1]
  && v[12] === "COMPLETE" && v[13] === "BB_OBSERVATION_RESULT_V1" && timestamp(v[14]));
const uuidV4 = (v: unknown) => typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const secretHex = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
register(PHASE7_CAP_ROLE_READY_SQL, "READ", "SELECT", v => v.length === 0);
register(PHASE7_CAP_ACQUIRE_SQL, "CAP_ACQUIRE", "SELECT", v => v.length === 4
  && lockKey(v[0]) && uuidV4(v[1]) && secretHex(v[2])
  && id(v[3]) && Number(v[3]) <= 300);
register(PHASE7_CAP_RELEASE_SQL, "CAP_RELEASE", "SELECT", v => v.length === 3
  && lockKey(v[0]) && uuidV4(v[1]) && secretHex(v[2]));
register(PHASE7_CAP_FENCE_SQL, "CAP_FENCE", "SELECT", v => v.length === 3
  && lockKey(v[0]) && uuidV4(v[1]) && secretHex(v[2]));
register(PHASE7_CAP_BIND_SQL, "CAP_BIND", "SELECT", v => v.length === 1 && secretHex(v[0]));
register(PHASE7_ACQUIRE_LOCK_SQL, "ACQUIRE_LOCK", "INSERT", v => v.length === 3 && lockKey(v[0]) && owner(v[1])
  && id(v[2]) && Number(v[2]) <= 300);
register(PHASE7_RELEASE_LOCK_SQL, "RELEASE_LOCK", "DELETE", v => v.length === 2 && lockKey(v[0]) && owner(v[1]));
register(PHASE7_FENCE_LOCK_SQL, "LOCK_FENCE", "SELECT", v => v.length === 2 && lockKey(v[0]) && owner(v[1]));
for (const sql of [PHASE7_BEGIN_SQL, PHASE7_COMMIT_SQL, PHASE7_ROLLBACK_SQL]) register(sql, "TRANSACTION", sql, v => v.length === 0);
export function phase7SqlRegistration(sql: string): Registration | undefined { return registry.get(sql); }

export const PHASE7_IDENTITY_SQL = PHASE7_READ_SQL[0];
export const PHASE7_LOCK_PRESENT_SQL = PHASE7_READ_SQL[1];
export const PHASE7_DUPLICATE_SQL = PHASE7_READ_SQL[2];
export const PHASE7_ORPHAN_SQL = PHASE7_READ_SQL[3];
export const PHASE7_DIGEST_SQL = Object.freeze(PHASE7_READ_SQL.slice(5, 8));
