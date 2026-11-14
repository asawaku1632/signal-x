#!/usr/bin/env node
// Manual development-only end-to-end probe. Not executed by CI or the public app.
// Requires credentials for an independent restricted LOGIN role. Never print the URL.
import { randomUUID } from "node:crypto";
import pg from "pg";

const DEV_PROJECT_REF = "jdtqwryiyxeuoraecorw";
const url = process.env.SCAN_PROVENANCE_DATABASE_URL;
if (process.env.SCAN_PROVENANCE_PERMISSION_PROBE !== "true") {
  throw new Error("PROBE_NOT_EXPLICITLY_ENABLED");
}
if (!url) throw new Error("PROBE_DEDICATED_DATABASE_URL_MISSING");
const parsed = new URL(url);
const user = decodeURIComponent(parsed.username);
if (!parsed.hostname.includes(DEV_PROJECT_REF) && !user.endsWith("." + DEV_PROJECT_REF)) {
  throw new Error("PROBE_REFUSES_NON_DEVELOPMENT_DATABASE");
}
if (!user.startsWith("scan_provenance_writer")) {
  throw new Error("PROBE_REFUSES_NON_RESTRICTED_USERNAME");
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 2000,
  statement_timeout: 2500,
  query_timeout: 3000,
});
const table = "scan_provenance_research.shadow_capture_test";
const key = "research:dev-permission-probe:" + randomUUID();
const generatedAt = new Date().toISOString();
const payload = JSON.stringify({ schema: "scan-provenance-capture-v1", synthetic: true });
const fingerprint = "a".repeat(64);
const sql = `INSERT INTO ${table}
  (snapshot_key,scan_generated_at,code,input_fingerprint_sha256,capture)
 VALUES ($1,$2::timestamptz,$3,$4,$5::jsonb)
 ON CONFLICT DO NOTHING`;

async function expectPrivilegeDenied(client, operation, sqlText, params = []) {
  try {
    await client.query(sqlText, params);
  } catch (error) {
    if (error?.code === "42501") return;
    throw new Error(operation + "_WRONG_ERROR_CODE:" + String(error?.code ?? "UNKNOWN"));
  }
  throw new Error(operation + "_UNEXPECTEDLY_ALLOWED");
}

let client;
try {
  client = await pool.connect();
  const role = (await client.query("SELECT current_user AS current_user, session_user AS session_user")).rows[0];
  if (role.current_user !== "scan_provenance_writer" || role.session_user !== "scan_provenance_writer") {
    throw new Error("PROBE_NOT_DIRECT_WRITER_LOGIN");
  }
  const first = await client.query(sql, [key, generatedAt, "2501", fingerprint, payload]);
  if (first.rowCount !== 1) throw new Error("FIRST_INSERT_FAILED");
  const duplicate = await client.query(sql, [key, generatedAt, "2501", fingerprint, payload]);
  if (duplicate.rowCount !== 0) throw new Error("DUPLICATE_WAS_NOT_IGNORED");
  await expectPrivilegeDenied(client, "SELECT", `SELECT * FROM ${table} LIMIT 1`);
  await expectPrivilegeDenied(client, "UPDATE", `UPDATE ${table} SET code='9999' WHERE snapshot_key=$1`, [key]);
  await expectPrivilegeDenied(client, "DELETE", `DELETE FROM ${table} WHERE snapshot_key=$1`, [key]);
  await expectPrivilegeDenied(client, "TRUNCATE", `TRUNCATE ${table}`);
  console.log(JSON.stringify({
    project: "signal-x-dev",
    login: "scan_provenance_writer",
    insert: "PASS",
    duplicateIgnored: "PASS",
    selectDenied: "PASS",
    updateDenied: "PASS",
    deleteDenied: "PASS",
    truncateDenied: "PASS",
    syntheticTestRowLeftIntentionally: true,
  }, null, 2));
} finally {
  if (client) client.release();
  await pool.end();
}
