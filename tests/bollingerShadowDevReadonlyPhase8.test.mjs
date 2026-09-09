import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { evaluateDevReadonly, validateDestination, validateConfiguration, parseArguments, DEV_REF, LIMITS }
  from "../scripts/evaluate-bollinger-shadow-dev-readonly.mjs";
import { evaluateBollingerShadow, canonicalPhase8Json, PHASE_8_EVALUATION_VERSION,
  PHASE_8_COHORT_DEFINITION_VERSION } from "../app/lib/technicalObservation/bollingerShadowEvaluation.ts";
import { resolveTseTradingDatesAfter } from "../app/lib/technicalObservation/tseMarketCalendar.ts";

// Invented credential-shaped fixture only. No environment access, pg import,
// socket, subprocess, provider, filesystem write or real connection in this suite.
const URL_FIXTURE = `postgresql://postgres:synthetic-only@db.${DEV_REF}.supabase.co:5432/postgres`;
const config = (extra = {}) => ({ confirmDev: DEV_REF, from: "2026-08-03", through: "2026-08-03",
  sourceCutoff: "2026-08-10T06:40:00.000Z", databaseUrl: URL_FIXTURE, ...extra });
const tradeDates = ["2026-08-04", "2026-08-06", "2026-08-10"];
function fixture(n = 1) {
  const rows = { snapshots: [], events: [], results: [] };
  for (let i = 1; i <= n; i++) {
    rows.snapshots.push({ id: String(i), code: String(1000 + i), observation_date: "2026-08-03",
      timeframe: "1D", close: "100", detector_version: "BB_OBSERVATION_V1", provider: "YAHOO_CHART",
      timezone: "Asia/Tokyo", bar_start_at: "2026-08-03 00:00:00+00", bar_end_at: "2026-08-03 06:30:00+00",
      created_at: "2026-08-03 06:40:00+00", shadow_only: true, phase: "7",
      execution_source: "PHASE_7_SHADOW_AUTOMATION", bar_ready: true });
    rows.events.push({ id: String(i), snapshot_id: String(i), side: i % 2 ? "LOWER" : "UPPER",
      sigma_level: i % 2 ? 2 : 3, event_type: "TOUCH", created_at: "2026-08-03 06:40:00+00" });
    [1, 3, 5].forEach((h, j) => rows.results.push({ id: String((i - 1) * 3 + j + 1), event_id: String(i),
      horizon: h, horizon_unit: "TRADING_DAY", entry_price: "100", future_close: "101", return_percent: "1",
      max_rise_percent: "2", max_drawdown_percent: "-1", max_rise_trade_date: "2026-08-04",
      max_drawdown_trade_date: "2026-08-04", evaluated_trade_date: tradeDates[j],
      evaluated_at: `${tradeDates[j]} 06:40:00+00`, created_at: `${tradeDates[j]} 06:40:00+00`,
      window_candle_count: h, result_quality: "COMPLETE", result_version: "BB_OBSERVATION_RESULT_V1",
      evaluation_visible: true }));
  }
  return rows;
}
// Model persisted filtering before response corruption. BigInt cursors cover the
// actual signed database domain; timestamp filtering retains microseconds.
function databaseTime(value) {
  const text = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const fraction = text.match(/\.(\d+)(?=Z|[+-])/)?.[1] ?? "";
  return BigInt(Date.parse(text)) * 1000n + BigInt(fraction.padEnd(6, "0").slice(3, 6));
}
function fake(rows, options = {}) {
  const calls = []; let optionsSeen;
  const fails = (op) => (Array.isArray(options.fail) ? options.fail : [options.fail]).includes(op);
  const client = {
    async connect() { calls.push({ op: "connect" }); if (fails("connect")) throw new Error(URL_FIXTURE); },
    async end() { calls.push({ op: "end" }); if (fails("end")) throw new Error(URL_FIXTURE); },
    async query(sql, values) {
      let queryTimeout;
      if (typeof sql === "object") { queryTimeout = sql.query_timeout; values = sql.values; sql = sql.text; }
      let op;
      if (sql === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY") op = "begin";
      else if (sql === "ROLLBACK") op = "rollback";
      else if (sql.includes("current_setting")) op = "guard";
      else if (sql.startsWith("SELECT EXISTS")) op = "relationships";
      else if (sql.includes("FROM public.technical_bb_observation_snapshots s")) op = "snapshots";
      else if (sql.includes("FROM public.technical_bb_observation_events e")) op = "events";
      else if (sql.includes("FROM public.technical_bb_observation_results r")) op = "results";
      else assert.fail("Unregistered SQL reached fake client");
      calls.push({ op, sql, values, queryTimeout });
      if (fails(op)) throw new Error(`sensitive database failure ${URL_FIXTURE}`);
      if (options.hang === op) return new Promise(() => {});
      if (op === "guard") return { rows: [{ read_only: "on", isolation: "repeatable read",
        cutoff_allowed: databaseTime(values[0]) <= databaseTime(options.databaseNow ?? "2028-01-01T00:00:00.000Z"), ...options.guard }] };
      if (["begin", "rollback"].includes(op)) return { rows: [] };
      if (op === "relationships") {
        const [from, through, cutoff] = values, cut = databaseTime(cutoff);
        const inRange = (s) => s && s.observation_date >= from && s.observation_date <= through;
        const snapshot = (e) => rows.snapshots.find((s) => String(s.id) === String(e.snapshot_id));
        const invalidEvent = rows.events.some((e) => {
          if (databaseTime(e.created_at) > cut) return false;
          const s = snapshot(e);
          return !s || (inRange(s) && databaseTime(s.created_at) > cut);
        });
        const invalidResult = rows.results.some((r) => {
          if (databaseTime(r.created_at) > cut) return false;
          const e = rows.events.find((e) => String(e.id) === String(r.event_id));
          if (!e) return true;
          const s = snapshot(e);
          return inRange(s) && (databaseTime(e.created_at) > cut || databaseTime(s.created_at) > cut
            || databaseTime(r.evaluated_at) > cut);
        });
        return { rows: [{ invalid: invalidEvent || invalidResult }] };
      }
      const cursor = values.at(-2), size = values.at(-1);
      const cut = databaseTime(values[op === "snapshots" ? 2 : 1]);
      assert.match(sql, /\$\d::bigint IS NULL OR [ser]\.id > \$\d::bigint/);
      let selected = rows[op].filter((r) => (cursor === null || BigInt(r.id) > BigInt(cursor))
        && databaseTime(r.created_at) <= cut);
      if (op === "snapshots") selected = selected.filter((r) => r.observation_date >= values[0] && r.observation_date <= values[1]);
      else selected = selected.filter((r) => values[0].includes(String(r[op === "events" ? "snapshot_id" : "event_id"])));
      if (op === "results") selected = selected.filter((r) => databaseTime(r.evaluated_at) <= cut);
      selected = selected.sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0).slice(0, size);
      if (options.page) selected = options.page(op, cursor === null ? null : Number(cursor), selected);
      return { rows: structuredClone(selected) };
    },
  };
  return { calls, get optionsSeen() { return optionsSeen; }, createClient(o) { optionsSeen = o; return client; } };
}
async function run(rows = fixture(), options = {}, input = config(), limits = {}) {
  const f = fake(rows, options);
  const report = await evaluateDevReadonly(input, { createClient: f.createClient, limits });
  return { report, f };
}
async function rejectsRow(table, field, value, expected) {
  // Deliberately corrupt a returned row after realistic SQL filtering to test
  // the independent validation boundary, not exclusion of future/out-of-scope rows.
  const { report, f } = await run(fixture(), { page(op, cursor, batch) {
    if (op === table && batch.length) batch[0][field] = value;
    return batch;
  } });
  assert.equal(report.status, "ADAPTER_FAILED");
  if (expected) assert.equal(report.errorCode, expected);
  assert.equal(report.evaluation, undefined);
  assert.deepEqual(f.calls.slice(-2).map((c) => c.op), ["rollback", "end"]);
}

test("exact DEV destination accepted with explicit verified TLS", () => {
  const o = validateDestination(URL_FIXTURE);
  assert.deepEqual(o.ssl, { rejectUnauthorized: true, servername: `db.${DEV_REF}.supabase.co` });
  assert.equal(o.port, 5432); assert.equal(o.database, "postgres");
  assert.equal(o.connectionString, undefined); assert.equal(o.options, "-c default_transaction_read_only=on -c timezone=UTC -c datestyle=ISO,YMD");
});
for (const [name, url] of [
  ["production", URL_FIXTURE.replace(DEV_REF, "paygtakajhvatwejygda")],
  ["suffix", URL_FIXTURE.replace(".supabase.co", ".supabase.co.attacker.test")],
  ["substring", URL_FIXTURE.replace(`db.${DEV_REF}`, `db.prefix${DEV_REF}`)],
  ["custom", URL_FIXTURE.replace(`db.${DEV_REF}.supabase.co`, "example.test")],
  ["ipv4", URL_FIXTURE.replace(`db.${DEV_REF}.supabase.co`, "127.0.0.1")],
  ["ipv6", URL_FIXTURE.replace(`db.${DEV_REF}.supabase.co`, "[::1]")],
  ["encoding", URL_FIXTURE.replace("synthetic-only", "%ZZ")],
  ["utf8 encoding", URL_FIXTURE.replace("synthetic-only", "%ff")],
  ["malformed", "not a URL"], ["protocol", URL_FIXTURE.replace("postgresql:", "https:")],
  ["pooler user", URL_FIXTURE.replace("postgres:", `postgres.${DEV_REF}:`)],
  ["conflicting production user", URL_FIXTURE.replace("postgres:", "postgres.paygtakajhvatwejygda:")],
  ["tls override", URL_FIXTURE + "?sslmode=disable"], ["options", URL_FIXTURE + "?options=x"],
  ["fragment", URL_FIXTURE + "#x"], ["port", URL_FIXTURE.replace(":5432", ":6543")],
  ["database", URL_FIXTURE.replace("/postgres", "/other")],
  ["empty password", URL_FIXTURE.replace("synthetic-only", "")],
]) test(`destination rejects ${name} before client construction`, async () => {
  let connections = 0;
  const r = await evaluateDevReadonly(config({ databaseUrl: url }), { createClient() { connections++; assert.fail(); } });
  assert.equal(r.status, "ADAPTER_FAILED"); assert.equal(connections, 0);
  assert.ok(!JSON.stringify(r).includes("synthetic-only"));
  if (name === "production") assert.equal(r.errorCode, "PRODUCTION_REJECTED");
});
for (const [name, extra] of [
  ["missing confirmation", { confirmDev: undefined }], ["missing cutoff", { sourceCutoff: undefined }],
  ["offset cutoff", { sourceCutoff: "2026-08-10T15:40:00.000+09:00" }],
  ["missing milliseconds", { sourceCutoff: "2026-08-10T06:40:00Z" }],
  ["invalid cutoff day", { sourceCutoff: "2026-02-30T06:40:00.000Z" }],
  ["reverse range", { from: "2026-08-04" }], ["wide range", { from: "2025-01-01" }],
  ["invalid date", { from: "2026-02-30" }], ["range beyond cutoff", { through: "2026-08-11" }],
]) test(`configuration rejects ${name}`, () => assert.throws(() => validateConfiguration(config(extra))));
test("CLI requires exactly explicit known unique arguments", () => {
  const args = ["--confirm-dev", DEV_REF, "--from", "2026-08-03", "--through", "2026-08-03", "--source-cutoff", config().sourceCutoff];
  assert.equal(parseArguments(args).confirmDev, DEV_REF);
  assert.throws(() => parseArguments([...args, "--from", "2026-08-03"]));
  assert.throws(() => parseArguments([...args, "--save", "true"]));
  assert.throws(() => parseArguments(args.slice(0, -1)));
});
test("transaction guard precedes all data and always rolls back success", async () => {
  const { report, f } = await run();
  assert.equal(report.evaluation.status, "INSUFFICIENT_SAMPLE");
  assert.deepEqual(f.calls.map((c) => c.op), ["connect", "begin", "guard", "relationships", "snapshots", "events", "results", "rollback", "end"]);
  assert.equal(f.optionsSeen.ssl.rejectUnauthorized, true);
});
for (const [name, guard, code] of [
  ["read only", { read_only: "off" }, "READ_ONLY_GUARD_FAILED"],
  ["isolation", { isolation: "read committed" }, "ISOLATION_GUARD_FAILED"],
  ["future cutoff", { cutoff_allowed: false }, "FUTURE_CUTOFF"],
]) test(`rejects ${name} guard`, async () => {
  const { report, f } = await run(fixture(), { guard });
  assert.equal(report.errorCode, code); assert.ok(!f.calls.some((c) => c.op === "snapshots"));
  assert.deepEqual(f.calls.slice(-2).map((c) => c.op), ["rollback", "end"]);
});
for (const fail of ["connect", "begin", "guard", "relationships", "snapshots", "events", "results", "rollback", "end"])
  test(`cleanup and sanitization on ${fail} failure`, async () => {
    const { report, f } = await run(fixture(), { fail });
    assert.equal(report.status, "ADAPTER_FAILED");
    assert.deepEqual(f.calls.slice(-2).map((c) => c.op), ["rollback", "end"]);
    assert.ok(!canonicalPhase8Json(report).includes("synthetic-only"));
  });
test("query timeout aborts and closes", async () => {
  const { report, f } = await run(fixture(), { hang: "snapshots" }, config(), { statementTimeoutMs: 5 });
  assert.equal(report.errorCode, "TIMEOUT"); assert.equal(f.calls.at(-1).op, "end");
});
test("relationship audit fails closed", async () => {
  const rows = fixture(); rows.results[0].event_id = "999";
  assert.equal((await run(rows)).report.errorCode, "PARENT_CUTOFF_INCONSISTENCY");
});
test("query surface has fixed parameterized cutoff, ordering, no OFFSET or writes", async () => {
  const { f } = await run();
  for (const c of f.calls.filter((c) => c.sql)) {
    assert.ok(!/\b(INSERT|UPDATE|DELETE|UPSERT|COMMIT|CREATE|ALTER|DROP|OFFSET|CALL|COPY)\b/i.test(c.sql));
    if (["snapshots", "events", "results"].includes(c.op)) {
      assert.match(c.sql, /created_at <= \$\d::timestamptz/);
      assert.match(c.sql, /ORDER BY [ser]\.id LIMIT \$\d/);
      assert.match(c.sql, /[ser]\.id > \$\d::bigint/);
      assert.ok(c.values.includes(config().sourceCutoff));
      assert.ok(!c.sql.includes(config().sourceCutoff));
    }
    if (c.op === "results") assert.match(c.sql, /evaluated_at <= \$2::timestamptz/);
  }
});
test("keyset pagination and parent batching preserve output and digest", async () => {
  const rows = fixture(9);
  const a = await run(rows, {}, config(), { pageSize: 2 });
  const b = await run(rows, {}, config(), { pageSize: 7 });
  assert.deepEqual(a.report, b.report);
  assert.ok(a.f.calls.filter((c) => c.op === "snapshots").some((c) => Number(c.values.at(-2)) > 0));
});
test("duplicate across pages rejected", async () => {
  const { report } = await run(fixture(2), { page(op, cursor, rows) {
    return op === "snapshots" && cursor ? [fixture().snapshots[0]] : rows;
  } }, config(), { pageSize: 1 });
  assert.equal(report.errorCode, "NON_MONOTONIC_PAGE");
});
for (const key of ["snapshots", "events", "results", "bytes"])
  test(`${key} bound never produces truncated evaluation`, async () => {
    const { report } = await run(fixture(3), {}, config(), { [key]: 2 });
    assert.equal(report.status, "ADAPTER_FAILED"); assert.equal(report.evaluation, undefined);
  });
test("limits cannot be raised", async () => {
  assert.equal((await run(fixture(), {}, config(), { events: LIMITS.events + 1 })).report.errorCode, "INVALID_LIMITS");
});
for (const [table, field, value, code] of [
  ["snapshots", "close", "", "INVALID_NUMBER"], ["snapshots", "close", null, "INVALID_NUMBER"],
  ["snapshots", "close", " 100", "INVALID_NUMBER"], ["snapshots", "close", "0x64", "INVALID_NUMBER"],
  ["snapshots", "close", "1e999", "INVALID_NUMBER"], ["snapshots", "close", "0", "INVALID_PRICE"],
  ["snapshots", "id", "9007199254740993", "UNSAFE_INTEGER"],
  ["snapshots", "shadow_only", "true", "INVALID_PROVENANCE"],
  ["snapshots", "phase", "6", "INVALID_PROVENANCE"], ["snapshots", "provider", "OTHER", "INVALID_PROVENANCE"],
  ["snapshots", "timeframe", "1W", "INVALID_PROVENANCE"], ["snapshots", "timezone", "UTC", "INVALID_PROVENANCE"],
  ["snapshots", "execution_source", "OTHER", "INVALID_PROVENANCE"],
  ["snapshots", "detector_version", "OTHER", "DETECTOR_VERSION_MISMATCH"],
  ["events", "side", "OTHER", "INVALID_EVENT"], ["events", "sigma_level", 4, "INVALID_EVENT"],
  ["results", "result_version", "OTHER", "RESULT_VERSION_MISMATCH"],
  ["results", "result_quality", "PARTIAL", "INVALID_RESULT_LIFECYCLE"],
  ["results", "horizon_unit", "DAY", "INVALID_RESULT_LIFECYCLE"],
  ["results", "window_candle_count", 3, "INVALID_RESULT_LIFECYCLE"],
  ["results", "entry_price", "101", "PRICE_MISMATCH"],
  ["results", "return_percent", "NaN", "INVALID_NUMBER"],
  ["results", "return_percent", "Infinity", "INVALID_NUMBER"],
  ["results", "return_percent", "1e999", "INVALID_NUMBER"],
  ["results", "evaluated_trade_date", "2026-08-05", "RESULT_CALENDAR_MISMATCH"],
  ["results", "max_rise_trade_date", "2026-08-02", "RESULT_CALENDAR_MISMATCH"],
  ["results", "max_drawdown_trade_date", "2026-08-05", "RESULT_CALENDAR_MISMATCH"],
  ["results", "created_at", "2026-08-10 06:40:00.000001+00", "CUTOFF_INCONSISTENCY"],
  ["results", "evaluated_at", "2026-08-10 06:40:00.000001+00", "CUTOFF_INCONSISTENCY"],
]) test(`row rejects ${table}.${field}=${String(value)}`, () => rejectsRow(table, field, value, code));
for (const value of [NaN, Infinity, -Infinity]) test(`nonfinite native number ${value} fails closed`, async () => {
  const r = fixture(); r.results[0].return_percent = value;
  assert.equal((await run(r)).report.status, "ADAPTER_FAILED");
});
test("snapshot natural key duplicate", async () => {
  const r = fixture(2); r.snapshots[1].code = r.snapshots[0].code;
  assert.equal((await run(r)).report.errorCode, "DUPLICATE_SNAPSHOT_KEY");
});
test("logical duplicate events are not deduplicated", async () => {
  const r = fixture(); r.events.push({ ...r.events[0], id: "2" });
  assert.equal((await run(r)).report.errorCode, "DUPLICATE_LOGICAL_EVENT");
});
test("duplicate result horizon rejected", async () => {
  const r = fixture(); r.results.push({ ...r.results[0], id: "4" });
  assert.equal((await run(r)).report.errorCode, "DUPLICATE_RESULT_HORIZON");
});
for (const kind of ["events", "results"]) test(`invalid ${kind} parent returned by reader rejected`, async () => {
  const { report } = await run(fixture(), { page(op, cursor, batch) {
    return op === kind ? batch.map((r) => ({ ...r, [kind === "events" ? "snapshot_id" : "event_id"]: "999" })) : batch;
  } });
  assert.equal(report.errorCode, kind === "events" ? "MISSING_SNAPSHOT" : "MISSING_EVENT");
});
test("missing horizons stay absent and classified due", async () => {
  const r = fixture(); r.results = r.results.slice(0, 1);
  const { report } = await run(r);
  assert.deepEqual(report.lifecycle.dueButAbsent, { h1: 0, h3: 1, h5: 1 });
  assert.equal(report.evaluation.cohorts[0].horizons[1].completeCount, 0);
  assert.equal(report.evaluation.metadata.incompleteSampleCount, 1);
});
test("no results retained; not yet due at cutoff", async () => {
  const r = fixture(); r.results = [];
  const { report } = await run(r, {}, config({ sourceCutoff: "2026-08-03T06:40:00.000Z" }));
  assert.equal(report.counts.events, 1);
  assert.deepEqual(report.lifecycle.notYetDue, { h1: 1, h3: 1, h5: 1 });
});
test("15:40 JST exact readiness boundary", async () => {
  const r = fixture(); r.results = [];
  const before = (await run(r, {}, config({ sourceCutoff: "2026-08-04T06:39:59.999Z" }))).report;
  const at = (await run(r, {}, config({ sourceCutoff: "2026-08-04T06:40:00.000Z" }))).report;
  assert.equal(before.lifecycle.notYetDue.h1, 1); assert.equal(at.lifecycle.dueButAbsent.h1, 1);
});
test("present premature result fails rather than becoming missing", async () => {
  const r = fixture(); r.results = [r.results[0]];
  r.results[0].created_at = r.results[0].evaluated_at = "2026-08-04 06:39:59+00";
  assert.equal((await run(r, {}, config({ sourceCutoff: "2026-08-04T06:39:59.999Z" }))).report.errorCode, "RESULT_CALENDAR_MISMATCH");
});
test("frozen calendar excludes holidays and weekends", () => {
  assert.deepEqual(resolveTseTradingDatesAfter("2026-09-18", 5), ["2026-09-24", "2026-09-25", "2026-09-28", "2026-09-29", "2026-09-30"]);
});
test("calendar coverage fails acquisition", async () => {
  const r = fixture(); r.snapshots[0].observation_date = "2027-12-30";
  r.snapshots[0].bar_start_at = "2027-12-30 00:00:00+00"; r.snapshots[0].bar_end_at = "2027-12-30 06:30:00+00";
  assert.equal((await run(r, {}, config({ from: "2027-12-30", through: "2027-12-30", sourceCutoff: "2027-12-31T12:00:00.000Z" }))).report.errorCode, "CALENDAR_UNAVAILABLE");
});
for (const n of [29, 30, 99, 100]) test(`frozen evaluator sample policy and exact output at ${n}`, async () => {
  const r = fixture(n), { report } = await run(r);
  const expectedInput = { sourceCutoff: config().sourceCutoff, evaluationVersion: PHASE_8_EVALUATION_VERSION,
    cohortDefinitionVersion: PHASE_8_COHORT_DEFINITION_VERSION, detectorVersion: "BB_OBSERVATION_V1",
    resultVersion: "BB_OBSERVATION_RESULT_V1", calendarVersion: "JPX_MARKET_HOLIDAYS_2026_2027_2026-02-06", readOnly: true,
    events: r.events.map((e) => ({ eventId: Number(e.id), snapshotId: Number(e.snapshot_id),
      code: r.snapshots[Number(e.snapshot_id) - 1].code, observationDate: "2026-08-03", side: e.side,
      sigmaLevel: e.sigma_level, eventType: e.event_type, detectorVersion: "BB_OBSERVATION_V1",
      results: [1, 3, 5].map((h, j) => ({ horizon: h, returnPercent: 1, maxRisePercent: 2, maxDrawdownPercent: -1,
        expectedTradeDate: tradeDates[j], evaluatedTradeDate: tradeDates[j], resultVersion: "BB_OBSERVATION_RESULT_V1",
        calendarVersion: "JPX_MARKET_HOLIDAYS_2026_2027_2026-02-06" })) })) };
  assert.deepEqual(report.evaluation, evaluateBollingerShadow(expectedInput));
  assert.equal(report.evaluation.cohorts.length, 13);
  const metrics = report.evaluation.cohorts[0].horizons[0].metrics;
  if (n < 30) assert.equal(metrics, null);
  else { assert.equal(metrics.meanReturn, 1); assert.equal("populationStandardDeviation" in metrics, n >= 100); }
});
test("input/digest/canonical output deterministic without raw data", async () => {
  const r = fixture(3), before = structuredClone(r);
  const a = (await run(r)).report, b = (await run(r)).report;
  assert.equal(canonicalPhase8Json(a), canonicalPhase8Json(b)); assert.deepEqual(r, before);
  assert.match(a.sourceDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(a.input, undefined); assert.equal(a.calendarVersionOrigin, "CODE_VALIDATION");
  r.results[0].return_percent = "2";
  assert.notEqual((await run(r)).report.sourceDigest, a.sourceDigest);
  assert.ok(!canonicalPhase8Json(a).includes("synthetic-only"));
});
test("import and fixed SQL isolation; no filesystem persistence or provider paths", async () => {
  const src = await readFile(new URL("../scripts/evaluate-bollinger-shadow-dev-readonly.mjs", import.meta.url), "utf8");
  const imports = [...src.matchAll(/(?:from\s+|import\()(["'])([^"']+)\1/g)].map((m) => m[2]);
  assert.deepEqual(imports, ["node:crypto", "node:url", "node:perf_hooks",
    "../app/lib/technicalObservation/bollingerShadowEvaluation.ts", "../app/lib/technicalObservation/tseMarketCalendar.ts", "pg/lib/client.js"]);
  assert.ok(!/writeFile|appendFile|createWriteStream|fetch\(|advisory|cron_execution_locks|rejectUnauthorized:\s*false/.test(src));
  assert.ok(!/export\s+(?:const|function)\s+(?:SQL|query)/.test(src));
});

test("exact decimal price equivalence is accepted", async () => {
  const r = fixture(); r.results[0].entry_price = "100.000";
  assert.ok((await run(r)).report.evaluation);
});
test("sub-IEEE price discrepancy is rejected", () => rejectsRow("results", "entry_price", "100.000000000000001", "PRICE_MISMATCH"));
test("numeric underflow is rejected", () => rejectsRow("results", "return_percent", "1e-999", "NUMERIC_UNDERFLOW"));
test("truncated overlong numeric text fails closed", () => rejectsRow("results", "return_percent", "0." + "0".repeat(127), "INVALID_NUMBER"));
test("timestamp cannot normalize an invalid 24-hour clock", () => rejectsRow("events", "created_at", "2026-08-03 24:00:00+00", "INVALID_TIMESTAMP"));
test("exact microsecond cutoff is accepted", async () => {
  const r = fixture(); r.results[0].created_at = "2026-08-10 06:40:00.000000+00";
  assert.ok((await run(r)).report.evaluation);
});
for (const table of ["snapshots", "events"]) test(`${table} cutoff boundary enforced independently`, () =>
  rejectsRow(table, "created_at", "2026-08-10 06:40:00.000001+00", "CUTOFF_INCONSISTENCY"));
test("snapshot bar completion after cutoff rejected", () => rejectsRow("snapshots", "bar_end_at", "2026-08-11 06:30:00+00", "INVALID_BAR_WINDOW"));
test("scope violations fail rather than silently excluding rows", () => rejectsRow("snapshots", "observation_date", "2026-08-04", "OUT_OF_SCOPE"));
test("366 inclusive dates accepted, 367 rejected", () => {
  assert.ok(validateConfiguration(config({ from: "2026-01-01", through: "2027-01-01", sourceCutoff: "2027-01-02T00:00:00.000Z" })));
  assert.throws(() => validateConfiguration(config({ from: "2026-01-01", through: "2027-01-02", sourceCutoff: "2027-01-02T00:00:00.000Z" })));
});
test("zero rows produces 13 suppressed cohorts", async () => {
  const { report } = await run(fixture(0));
  assert.equal(report.evaluation.status, "INSUFFICIENT_SAMPLE");
  assert.equal(report.evaluation.cohorts.length, 13);
  assert.ok(report.evaluation.cohorts.every((c) => c.horizons.every((h) => h.metrics === null)));
});
test("complete and partial lifecycle precedence stays frozen", async () => {
  const r = fixture(31); r.results = r.results.filter((r) => !(r.event_id === "31" && r.horizon === 5));
  const { report } = await run(r);
  assert.equal(report.evaluation.status, "INCOMPLETE_DATA");
  assert.equal(report.evaluation.cohorts[0].horizons[2].completeCount, 30);
  assert.notEqual(report.evaluation.cohorts[0].horizons[2].metrics, null);
});
test("higher horizon without lower stays a partial lifecycle", async () => {
  const r = fixture(); r.results = [r.results[2]];
  const { report } = await run(r);
  assert.equal(report.evaluation.cohorts[0].horizons[0].completeCount, 0);
  assert.equal(report.evaluation.cohorts[0].horizons[2].completeCount, 1);
});
test("calendar holiday mapping through adapter", async () => {
  const r = fixture(); const expected = ["2026-09-24", "2026-09-28", "2026-09-30"];
  Object.assign(r.snapshots[0], { observation_date: "2026-09-18", bar_start_at: "2026-09-18 00:00:00+00",
    bar_end_at: "2026-09-18 06:30:00+00", created_at: "2026-09-18 06:40:00+00" });
  r.events[0].created_at = r.snapshots[0].created_at;
  r.results.forEach((r, i) => Object.assign(r, { evaluated_trade_date: expected[i],
    max_rise_trade_date: expected[0], max_drawdown_trade_date: expected[0],
    created_at: `${expected[i]} 06:40:00+00`, evaluated_at: `${expected[i]} 06:40:00+00` }));
  assert.ok((await run(r, {}, config({ from: "2026-09-18", through: "2026-09-18", sourceCutoff: "2026-09-30T06:40:00.000Z" }))).report.evaluation);
});
test("factory exceptions are sanitized without connection", async () => {
  const report = await evaluateDevReadonly(config(), { createClient() { throw new Error(URL_FIXTURE); } });
  assert.deepEqual(report, { status: "ADAPTER_FAILED", errorCode: "ACQUISITION_FAILED" });
});
test("no default real client is reachable through exported evaluator", async () => {
  assert.equal((await evaluateDevReadonly(config())).errorCode, "CLIENT_FACTORY_REQUIRED");
});
test("pre-cancelled operation never constructs client", async () => {
  const controller = new AbortController(); controller.abort();
  const report = await evaluateDevReadonly(config(), { signal: controller.signal, createClient() { assert.fail(); } });
  assert.equal(report.errorCode, "CANCELLED");
});
test("cancellation while acquiring rolls back and closes", async () => {
  const controller = new AbortController();
  const f = fake(fixture(), { page(op, cursor, batch) { if (op === "snapshots") controller.abort(); return batch; } });
  const report = await evaluateDevReadonly(config(), { signal: controller.signal, createClient: f.createClient });
  assert.equal(report.errorCode, "CANCELLED");
  assert.deepEqual(f.calls.slice(-2).map((c) => c.op), ["rollback", "end"]);
});
test("cleanup timeout cannot expose successful evaluation", async () => {
  const { report, f } = await run(fixture(), { hang: "rollback" }, config(), { cleanupTimeoutMs: 5 });
  assert.equal(report.errorCode, "CLEANUP_FAILED"); assert.equal(f.calls.at(-1).op, "end");
});
test("full page at exact bound requires exhaustion check", async () => {
  const { report, f } = await run(fixture(2), {}, config(), { pageSize: 2, snapshots: 2, events: 2, results: 6 });
  assert.ok(report.evaluation);
  assert.equal(f.calls.filter((c) => c.op === "snapshots").length, 2);
});
test("multiple result versions are rejected, never filtered or chosen", async () => {
  const r = fixture(); r.results.push({ ...r.results[0], id: "4", result_version: "OTHER" });
  assert.equal((await run(r)).report.errorCode, "RESULT_VERSION_MISMATCH");
});
test("validation failure order independent of parent/page ordering", async () => {
  const r = fixture(4);
  r.events.reverse().forEach((e, i) => { e.id = String(i + 1); });
  r.results[0].entry_price = "102"; r.results[3].result_version = "OTHER";
  const a = (await run(r, {}, config(), { pageSize: 1 })).report;
  const b = (await run(r, {}, config(), { pageSize: 4 })).report;
  assert.deepEqual(a, b); assert.equal(a.status, "ADAPTER_FAILED");
});
test("unregistered override cannot widen execution surface", async () => {
  assert.equal((await run(fixture(), {}, config(), { sql: 1 })).report.errorCode, "INVALID_LIMITS");
});
test("project ref in password is not used as identity evidence", () => {
  assert.throws(() => validateDestination(`postgresql://postgres:${DEV_REF}@example.test:5432/postgres`));
});
test("small sample reports no recommendation or raw metadata", async () => {
  const { report } = await run();
  const text = canonicalPhase8Json(report);
  assert.ok(!/"(?:BUY|SELL|WAIT)"|password|postgresql:|entry_price|execution_source/.test(text));
});

test("bar dates must agree with observation date in JST", () => rejectsRow("snapshots", "bar_end_at", "2026-08-04 06:30:00+00", "BAR_DATE_MISMATCH"));
test("per-row numeric SELECT projections are bounded before transfer", async () => {
  const { f } = await run();
  const resultSql = f.calls.find((c) => c.op === "results").sql;
  assert.match(resultSql, /left\(r\.return_percent::text,129\)/);
  const snapshotSql = f.calls.find((c) => c.op === "snapshots").sql;
  assert.ok(!/SELECT\s+\*/i.test(snapshotSql));
  assert.match(snapshotSql, /jsonb_typeof\(s\.metadata->'phase'\)='string'/);
});

async function invalidIdAcquisition(table, badId, pageSize = 1) {
  const rows = fixture(2);
  rows[table][0].id = String(badId);
  if (table === "snapshots") rows.events[0].snapshot_id = String(badId);
  if (table === "events") rows.results.filter((r) => r.event_id === "1").forEach((r) => { r.event_id = String(badId); });
  return run(rows, {}, config(), { pageSize });
}
for (const table of ["snapshots", "events", "results"]) for (const badId of [0, -1])
  test(`acquisition exposes and rejects ${table} ID ${badId}`, async () => {
    const { report, f } = await invalidIdAcquisition(table, badId);
    assert.deepEqual(report, { status: "ADAPTER_FAILED", errorCode: "INVALID_ID" });
    assert.equal(report.evaluation, undefined);
    assert.equal(report.lifecycle, undefined);
    assert.equal(f.calls.find((c) => c.op === table).values.at(-2), null);
    assert.deepEqual(f.calls.slice(-2).map((c) => c.op), ["rollback", "end"]);
  });
test("invalid-ID probes never invoke frozen evaluator (in-process V8 call counts)", async () => {
  // Local inspector session only: no listening port, files, or network connection.
  const { Session } = await import("node:inspector/promises");
  const session = new Session(); session.connect();
  try {
    await session.post("Profiler.enable");
    await session.post("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
    for (const table of ["snapshots", "events", "results"]) for (const id of [0, -1])
      assert.equal((await invalidIdAcquisition(table, id)).report.status, "ADAPTER_FAILED");
    // A known direct call is the positive control: zero-count functions may be
    // omitted by V8. Exactly one total call proves the six adapter probes added none.
    evaluateBollingerShadow({ readOnly: false });
    const { result } = await session.post("Profiler.takePreciseCoverage");
    const evaluator = result.find((s) => s.url.endsWith("/bollingerShadowEvaluation.ts"));
    assert.ok(evaluator);
    const fn = evaluator.functions.find((f) => f.functionName === "evaluateBollingerShadow");
    assert.ok(fn);
    assert.equal(fn.ranges[0].count, 1);
  } finally {
    await session.post("Profiler.stopPreciseCoverage");
    await session.post("Profiler.disable");
    session.disconnect();
  }
});
for (const table of ["snapshots", "events", "results"]) test(`${table} minimum PostgreSQL BIGINT exposed without sentinel`, async () => {
  const { report } = await invalidIdAcquisition(table, "-9223372036854775808");
  assert.equal(report.status, "ADAPTER_FAILED");
  assert.equal(report.errorCode, "UNSAFE_INTEGER");
});
test("positive ID 1 and multi-page acquisition still work", async () => {
  const { report, f } = await run(fixture(2), {}, config(), { pageSize: 1 });
  assert.equal(report.counts.snapshots, 2); assert.equal(report.counts.events, 2); assert.equal(report.counts.results, 6);
  assert.ok(report.evaluation);
  assert.deepEqual(f.calls.filter((c) => c.op === "snapshots").map((c) => c.values.at(-2)), [null, "1", "2"]);
});
test("nonpositive result in a later parent batch cannot become missing", async () => {
  const rows = fixture(2); rows.results[3].id = "0";
  const { report, f } = await run(rows, {}, config(), { pageSize: 1 });
  assert.equal(report.errorCode, "INVALID_ID"); assert.equal(report.lifecycle, undefined);
  assert.ok(f.calls.some((c) => c.op === "results" && c.values[0].includes("2")));
});
test("a nonpositive row returned after a positive page fails closed", async () => {
  const { report } = await run(fixture(2), { page(op, cursor, batch) {
    if (op === "snapshots" && cursor !== null && batch.length) batch[0].id = "-1";
    return batch;
  } }, config(), { pageSize: 1 });
  assert.equal(report.errorCode, "INVALID_ID"); assert.equal(report.evaluation, undefined);
});
test("canonical byte count, digest and evaluator output invariant at exact admission boundary", async () => {
  const rows = fixture(2), canonical = canonicalPhase8Json(rows);
  const bytes = Buffer.byteLength(canonical);
  const a = await run(rows, {}, config(), { pageSize: 1, bytes });
  const b = await run(rows, {}, config(), { pageSize: 250, bytes });
  assert.ok(a.report.evaluation); assert.ok(b.report.evaluation);
  assert.equal(a.report.sourceBytes, bytes); assert.equal(b.report.sourceBytes, bytes);
  assert.deepEqual(a.report, b.report);
  const { createHash } = await import("node:crypto");
  assert.equal(a.report.sourceDigest, `sha256:${createHash("sha256").update(canonical).digest("hex")}`);
  for (const pageSize of [1, 250]) {
    const { report } = await run(rows, {}, config(), { pageSize, bytes: bytes - 1 });
    assert.deepEqual(report, { status: "ADAPTER_FAILED", errorCode: "BYTE_LIMIT_EXCEEDED" });
  }
});
test("empty terminal pages contribute zero canonical dataset bytes", async () => {
  const rows = fixture(1), bytes = Buffer.byteLength(canonicalPhase8Json(rows));
  const { report, f } = await run(rows, {}, config(), { pageSize: 1, bytes });
  assert.equal(report.sourceBytes, bytes);
  assert.equal(f.calls.filter((c) => c.op === "snapshots").length, 2);
  const empty = fixture(0), emptyBytes = Buffer.byteLength(canonicalPhase8Json(empty));
  for (const pageSize of [1, 250]) {
    assert.equal((await run(empty, {}, config(), { pageSize, bytes: emptyBytes })).report.sourceBytes, emptyBytes);
    assert.equal((await run(empty, {}, config(), { pageSize, bytes: emptyBytes - 1 })).report.errorCode, "BYTE_LIMIT_EXCEEDED");
  }
});
test("previous 1979-byte review probe has identical admission for pages 1 and 250", async () => {
  const a = (await run(fixture(), {}, config(), { pageSize: 1, bytes: 1979 })).report;
  const b = (await run(fixture(), {}, config(), { pageSize: 250, bytes: 1979 })).report;
  assert.deepEqual(a, b);
  // Full dataset object keys/framing are now counted as well as rows.
  assert.equal(a.errorCode, "BYTE_LIMIT_EXCEEDED");
});
const approvedArgs = () => ["--confirm-dev", DEV_REF, "--from", "2026-08-03", "--through", "2026-08-03", "--source-cutoff", config().sourceCutoff];
for (const arg of ["--__proto__", "--constructor", "--toString", "__proto__", "constructor", "toString", "--unknown"])
  test(`CLI own-key validation rejects ${arg}`, () => {
    assert.throws(() => parseArguments([...approvedArgs(), arg, "synthetic"]), { code: "INVALID_ARGUMENTS" });
  });
test("valid CLI and duplicate rejection unchanged by own-key fix", () => {
  assert.deepEqual(parseArguments(approvedArgs()), { confirmDev: DEV_REF, from: "2026-08-03", through: "2026-08-03", sourceCutoff: config().sourceCutoff });
  for (let i = 0; i < approvedArgs().length; i += 2) {
    const pair = approvedArgs().slice(i, i + 2);
    assert.throws(() => parseArguments([...approvedArgs(), ...pair]), { code: "INVALID_ARGUMENTS" });
    assert.throws(() => parseArguments([...pair, ...approvedArgs()]), { code: "INVALID_ARGUMENTS" });
  }
});
test("faithful acquisition excludes future snapshots/events/results without losing visible rows", async () => {
  const rows = fixture(2);
  rows.snapshots[1].created_at = "2026-08-10 06:40:00.000001+00";
  rows.events[1].created_at = rows.snapshots[1].created_at;
  rows.results.filter((r) => r.event_id === "2").forEach((r) => { r.created_at = rows.snapshots[1].created_at; });
  rows.results[0].created_at = rows.snapshots[1].created_at;
  const { report } = await run(rows);
  assert.deepEqual(report.counts, { snapshots: 1, events: 1, results: 2 });
  assert.equal(report.lifecycle.dueButAbsent.h1, 1);
});
test("faithful observation scope excludes another day's population", async () => {
  const rows = fixture(2); rows.snapshots[1].observation_date = "2026-08-04";
  const { report } = await run(rows);
  assert.deepEqual(report.counts, { snapshots: 1, events: 1, results: 3 });
});
for (const table of ["snapshots", "events", "results"]) test(`invalid ${table} ID after cutoff is outside declared population`, async () => {
  const rows = fixture();
  rows[table][0].id = "0";
  rows[table][0].created_at = "2026-08-10 06:40:00.000001+00";
  if (table === "snapshots") {
    rows.events[0].snapshot_id = "0"; rows.events[0].created_at = rows.snapshots[0].created_at;
    rows.results.forEach((r) => { r.created_at = rows.snapshots[0].created_at; });
  }
  if (table === "events") rows.results.forEach((r) => { r.event_id = "0"; r.created_at = rows.events[0].created_at; });
  assert.ok((await run(rows)).report.evaluation);
});
test("nonpositive snapshot outside observation range is not a whole-database ID claim", async () => {
  const rows = fixture(2); rows.snapshots[1].id = "0"; rows.snapshots[1].observation_date = "2026-08-04";
  rows.events[1].snapshot_id = "0";
  assert.deepEqual((await run(rows)).report.counts, { snapshots: 1, events: 1, results: 3 });
});
for (const scenario of ["orphan event", "orphan result", "future snapshot parent", "future event parent", "future evaluated_at"])
  test(`derived relationship check rejects ${scenario}`, async () => {
    const rows = fixture(), future = "2026-08-10 06:40:00.000001+00";
    if (scenario === "orphan event") rows.events[0].snapshot_id = "999";
    if (scenario === "orphan result") rows.results[0].event_id = "999";
    if (scenario === "future snapshot parent") rows.snapshots[0].created_at = future;
    if (scenario === "future event parent") rows.events[0].created_at = future;
    if (scenario === "future evaluated_at") rows.results[0].evaluated_at = future;
    const { report, f } = await run(rows);
    assert.equal(report.errorCode, "PARENT_CUTOFF_INCONSISTENCY");
    assert.equal(report.evaluation, undefined); assert.ok(!f.calls.some((c) => c.op === "snapshots"));
  });
test("database timestamp guard uses equality and rejects one microsecond before cutoff", async () => {
  assert.ok((await run(fixture(), { databaseNow: config().sourceCutoff })).report.evaluation);
  assert.equal((await run(fixture(), { databaseNow: "2026-08-10T06:39:59.999999Z" })).report.errorCode, "FUTURE_CUTOFF");
});
for (const failures of [["snapshots"], ["snapshots", "rollback"], ["snapshots", "end"], ["rollback", "end"], ["end"]])
  test(`combined failure cleanup: ${failures.join(" + ")}`, async () => {
    const { report, f } = await run(fixture(), { fail: failures });
    assert.deepEqual(f.calls.slice(-2).map((c) => c.op), ["rollback", "end"]);
    assert.deepEqual(report, { status: "ADAPTER_FAILED", errorCode: failures.some((s) => ["rollback", "end"].includes(s)) ? "CLEANUP_FAILED" : "ACQUISITION_FAILED" });
    assert.ok(!canonicalPhase8Json(report).includes("synthetic-only"));
  });
for (const fail of [undefined, "rollback", "end", ["rollback", "end"]])
  test(`cancellation combined with cleanup failure ${String(fail)}`, async () => {
    const controller = new AbortController();
    const f = fake(fixture(), { fail, page(op, cursor, batch) { if (op === "snapshots") controller.abort(); return batch; } });
    const report = await evaluateDevReadonly(config(), { signal: controller.signal, createClient: f.createClient });
    assert.deepEqual(report, { status: "ADAPTER_FAILED", errorCode: fail ? "CLEANUP_FAILED" : "CANCELLED" });
    assert.deepEqual(f.calls.slice(-2).map((c) => c.op), ["rollback", "end"]);
  });
test("pending acquisition cancellation plus end failure remains sanitized", async () => {
  const controller = new AbortController();
  const f = fake(fixture(), { hang: "snapshots", fail: "end" });
  const timer = setTimeout(() => controller.abort(), 10);
  try {
    const report = await evaluateDevReadonly(config(), { signal: controller.signal, createClient: f.createClient });
    assert.deepEqual(report, { status: "ADAPTER_FAILED", errorCode: "CLEANUP_FAILED" });
    assert.deepEqual(f.calls.slice(-2).map((c) => c.op), ["rollback", "end"]);
  } finally { clearTimeout(timer); }
});

// Deterministic monotonic clock; production still uses performance.now().
// All scenarios retain the fixed-query fake above and inspect real evaluator
// calls using an in-process inspector session (no listening port or network).
async function withoutEvaluation(action) {
  const { Session } = await import("node:inspector/promises");
  const session = new Session(); session.connect();
  try {
    await session.post("Profiler.enable");
    await session.post("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
    await action();
    evaluateBollingerShadow({ readOnly: false }); // one known positive control
    const { result } = await session.post("Profiler.takePreciseCoverage");
    const script = result.find((s) => s.url.endsWith("/bollingerShadowEvaluation.ts"));
    const fn = script?.functions.find((f) => f.functionName === "evaluateBollingerShadow");
    assert.equal(fn?.ranges[0].count, 1, "failed adapter must add zero evaluator calls");
  } finally {
    await session.post("Profiler.stopPreciseCoverage");
    await session.post("Profiler.disable");
    session.disconnect();
  }
}
function deadlineFixture(hook = () => {}, options = {}) {
  const state = { time: 0, controller: new AbortController(), destroyed: 0, factoryCalls: 0 };
  const f = fake(fixture(3));
  const result = evaluateDevReadonly(config(), {
    limits: { timeoutMs: 100, statementTimeoutMs: 100, cleanupTimeoutMs: 20, pageSize: 1, ...options.limits },
    now: () => { if (options.beforeClock) options.beforeClock(state); return state.time; },
    signal: state.controller.signal,
    createClient(connection) {
      state.factoryCalls++;
      const client = f.createClient(connection);
      client.connection = { stream: { destroy() { state.destroyed++; } } };
      const connect = client.connect.bind(client), query = client.query.bind(client), end = client.end.bind(client);
      client.connect = async () => { await connect(); await hook("connect", state, f); };
      client.query = async (queryConfig) => {
        const response = await query(queryConfig), call = f.calls.at(-1);
        await hook(call.op, state, f, call);
        if (options.betweenPages && call.op === "snapshots") return {
          get rows() { options.betweenPages(state, call); return response.rows; },
        };
        return response;
      };
      client.end = async () => { await end(); await hook("end", state, f); };
      hook("factory", state, f);
      return client;
    },
  });
  return { state, f, result };
}
function deadlineFailure(report, code = "TIMEOUT") {
  assert.deepEqual(report, { status: "ADAPTER_FAILED", errorCode: code });
  assert.equal(report.evaluation, undefined);
  assert.ok(!JSON.stringify(report).includes("synthetic-only"));
}
function cleanupOnce(f) {
  assert.equal(f.calls.filter((c) => c.op === "rollback").length, 1);
  assert.equal(f.calls.filter((c) => c.op === "end").length, 1);
}
for (const op of ["factory", "connect", "begin", "guard", "relationships", "snapshots", "events", "results"])
  test("deadline expires at " + op + "; no later acquisition or evaluator", () => withoutEvaluation(async () => {
    const { result, f, state } = deadlineFixture((current, state) => { if (current === op) state.time = 100; });
    deadlineFailure(await result); cleanupOnce(f);
    if (op === "factory") assert.ok(!f.calls.some((c) => c.op === "connect"));
    else assert.deepEqual(f.calls.slice(f.calls.findIndex((c) => c.op === op) + 1).map((c) => c.op), ["rollback", "end"]);
    assert.equal(state.destroyed, 0);
  }));

test("deadline includes validation before factory/connect", () => withoutEvaluation(async () => {
  let reads = 0;
  const { result, state, f } = deadlineFixture(undefined, { beforeClock(state) { if (++reads > 1) state.time = 100; } });
  deadlineFailure(await result); assert.equal(state.factoryCalls, 0); assert.equal(f.calls.length, 0);
}));

test("deadline expires between pages; next source query never starts", () => withoutEvaluation(async () => {
  const { result, f } = deadlineFixture(undefined, { betweenPages(state) { state.time = 100; } });
  deadlineFailure(await result); cleanupOnce(f);
  assert.equal(f.calls.filter((c) => c.op === "snapshots").length, 1);
}));

for (const op of ["rollback", "end"])
  test("successful " + op + " crosses application deadline; evaluator remains uncalled", () => withoutEvaluation(async () => {
    const { result, f } = deadlineFixture((current, state) => {
      if (current === "results") state.time = 90;
      if (current === op) state.time = 100;
    });
    deadlineFailure(await result); cleanupOnce(f);
  }));

for (const op of ["factory", "guard", "snapshots", "events", "results", "rollback", "end"])
  test("external cancellation at " + op + " prevents evaluation", () => withoutEvaluation(async () => {
    const { result, f } = deadlineFixture((current, state) => { if (current === op) state.controller.abort(); });
    deadlineFailure(await result, "CANCELLED"); cleanupOnce(f);
    if (op === "factory") assert.ok(!f.calls.some((c) => c.op === "connect"));
  }));

test("already-aborted signal never constructs a client", () => withoutEvaluation(async () => {
  const { result, state } = deadlineFixture(undefined, { beforeClock(state) { state.controller.abort(); } });
  deadlineFailure(await result, "CANCELLED"); assert.equal(state.factoryCalls, 0);
}));

test("cancellation between pages prevents next query", () => withoutEvaluation(async () => {
  const { result, f } = deadlineFixture(undefined, { betweenPages(state) { state.controller.abort(); } });
  deadlineFailure(await result, "CANCELLED"); cleanupOnce(f);
  assert.equal(f.calls.filter((c) => c.op === "snapshots").length, 1);
}));

test("simultaneous deadline and cancellation deterministically select TIMEOUT", () => withoutEvaluation(async () => {
  const { result, f } = deadlineFixture((op, state) => {
    if (op === "snapshots") { state.time = 100; state.controller.abort(); }
  });
  deadlineFailure(await result); cleanupOnce(f);
}));

for (const failedCleanup of ["rollback", "end"])
  test("timeout plus " + failedCleanup + " failure is sanitized and forces shutdown", () => withoutEvaluation(async () => {
    const { result, state, f } = deadlineFixture((op, state) => {
      if (op === "guard") state.time = 100;
      if (op === failedCleanup) throw new Error(URL_FIXTURE);
    });
    deadlineFailure(await result, "CLEANUP_FAILED"); cleanupOnce(f); assert.equal(state.destroyed, 1);
  }));

test("cancellation plus rollback and end failures forces shutdown once", () => withoutEvaluation(async () => {
  const { result, state, f } = deadlineFixture((op, state) => {
    if (op === "snapshots") state.controller.abort();
    if (["rollback", "end"].includes(op)) throw new Error(URL_FIXTURE);
  });
  deadlineFailure(await result, "CLEANUP_FAILED"); cleanupOnce(f); assert.equal(state.destroyed, 1);
}));

test("pages share global budget and query timeout shrinks with remaining time", () => withoutEvaluation(async () => {
  const { result, f } = deadlineFixture((op, state) => { if (op === "snapshots") state.time = Math.min(100, state.time + 40); });
  deadlineFailure(await result); cleanupOnce(f);
  assert.deepEqual(f.calls.filter((c) => c.op === "snapshots").map((c) => c.queryTimeout), [100, 60, 20]);
  assert.ok(!f.calls.some((c) => c.op === "events"));
  assert.equal(f.optionsSeen.connectionTimeoutMillis, 100);
  assert.equal(f.optionsSeen.statement_timeout, 100);
}));

// Await operation-entry handshakes, then advance fake timers: no real sleeps.
for (const pending of ["connect", "begin", "guard", "relationships", "snapshots", "events", "results", "rollback", "end"])
  test("pending " + pending + " is bounded with fake timers", (t) => withoutEvaluation(async () => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let entered;
    const ready = new Promise((resolve) => { entered = resolve; });
    const { result, state, f } = deadlineFixture((op) => {
      if (op === pending) { entered(); return new Promise(() => {}); }
    });
    await ready;
    state.time = ["rollback", "end"].includes(pending) ? 20 : 100;
    t.mock.timers.tick(state.time);
    deadlineFailure(await result, ["rollback", "end"].includes(pending) ? "CLEANUP_FAILED" : "TIMEOUT");
    cleanupOnce(f);
    if (["rollback", "end"].includes(pending)) assert.equal(state.destroyed, 1);
  }));

test("rollback and end share one cleanup grace, including a pending end", (t) => withoutEvaluation(async () => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let entered;
  const ready = new Promise((resolve) => { entered = resolve; });
  const { result, state, f } = deadlineFixture((op, state) => {
    if (op === "rollback") { state.time = 15; t.mock.timers.tick(15); }
    if (op === "end") { entered(); return new Promise(() => {}); }
  });
  await ready; state.time = 20; t.mock.timers.tick(5);
  deadlineFailure(await result, "CLEANUP_FAILED"); cleanupOnce(f); assert.equal(state.destroyed, 1);
}));

test("pending query cancellation cannot produce late success", () => withoutEvaluation(async () => {
  let entered, finish;
  const ready = new Promise((resolve) => { entered = resolve; });
  const { result, state, f } = deadlineFixture((op) => {
    if (op === "snapshots") { entered(); return new Promise((resolve) => { finish = resolve; }); }
  });
  await ready; state.controller.abort();
  deadlineFailure(await result, "CANCELLED"); cleanupOnce(f);
  finish(); await Promise.resolve(); await Promise.resolve(); cleanupOnce(f);
}));

test("normal fast execution retains successful frozen evaluation", async () => {
  const { result, f } = deadlineFixture();
  const report = await result;
  assert.ok(report.evaluation); assert.equal(report.counts.snapshots, 3); cleanupOnce(f);
});

test("original review repro: successful end at 200ms cannot evaluate with 100ms budget", () => withoutEvaluation(async () => {
  const { result, f } = deadlineFixture((op, state) => { if (op === "end") state.time = 200; },
    { limits: { cleanupTimeoutMs: 1000 } });
  deadlineFailure(await result); cleanupOnce(f);
}));

test("late timeout detection cannot restart a cleanup grace beyond overall deadline plus grace", () => withoutEvaluation(async () => {
  const { result, f, state } = deadlineFixture((op, state) => { if (op === "guard") state.time = 500; });
  deadlineFailure(await result, "CLEANUP_FAILED");
  assert.equal(f.calls.filter((c) => c.op === "rollback").length, 0);
  assert.equal(f.calls.filter((c) => c.op === "end").length, 1);
  assert.equal(state.destroyed, 1);
}));

test("pending source plus pending rollback/end terminates at shared grace and destroys transport", (t) => withoutEvaluation(async () => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let sourceEntered, rollbackEntered, rejectEnd;
  const sourceReady = new Promise((resolve) => { sourceEntered = resolve; });
  const rollbackReady = new Promise((resolve) => { rollbackEntered = resolve; });
  const { result, state, f } = deadlineFixture((op) => {
    if (op === "snapshots") { sourceEntered(); return new Promise(() => {}); }
    if (op === "rollback") { rollbackEntered(); return new Promise(() => {}); }
    if (op === "end") return new Promise((_, reject) => { rejectEnd = reject; });
  });
  await sourceReady; state.time = 100; t.mock.timers.tick(100);
  await rollbackReady; state.time = 120; t.mock.timers.tick(20);
  deadlineFailure(await result, "CLEANUP_FAILED"); cleanupOnce(f); assert.equal(state.destroyed, 1);
  rejectEnd(new Error(URL_FIXTURE)); await Promise.resolve(); await Promise.resolve();
  cleanupOnce(f);
}));

test("statement timeout can shorten but never reset the application budget", (t) => withoutEvaluation(async () => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let entered;
  const ready = new Promise((resolve) => { entered = resolve; });
  const { result, state, f } = deadlineFixture((op) => {
    if (op === "snapshots") { entered(); return new Promise(() => {}); }
  }, { limits: { statementTimeoutMs: 25 } });
  await ready; state.time = 25; t.mock.timers.tick(25);
  deadlineFailure(await result); cleanupOnce(f);
  assert.equal(f.calls.find((c) => c.op === "snapshots").queryTimeout, 25);
}));
