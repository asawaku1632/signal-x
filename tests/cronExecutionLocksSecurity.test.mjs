import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n");

test("cron execution locks security migration enables RLS without policies", async () => {
  const sql = await read(
    "scripts/migrations/20260820_secure_cron_execution_locks.sql",
  );

  assert.match(
    sql,
    /ALTER TABLE public\.cron_execution_locks ENABLE ROW LEVEL SECURITY;/,
  );
  assert.doesNotMatch(sql, /FORCE ROW LEVEL SECURITY/i);
  assert.doesNotMatch(sql, /CREATE\s+POLICY/i);
});

test("cron execution locks security migration restricts Data API roles", async () => {
  const sql = await read(
    "scripts/migrations/20260820_secure_cron_execution_locks.sql",
  );

  assert.match(
    sql,
    /REVOKE ALL PRIVILEGES ON TABLE public\.cron_execution_locks\s+FROM PUBLIC, anon, authenticated;/,
  );
  assert.match(
    sql,
    /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.cron_execution_locks TO postgres;/,
  );
  assert.doesNotMatch(sql, /service_role/i);
});

test("original cron execution locks creation migration remains unchanged", async () => {
  const sql = normalizeNewlines(
    await read("scripts/migrations/20260810_create_cron_execution_locks.sql"),
  );

  const originalSql = `-- Prevent concurrent executions of date-scoped cron jobs.
-- Apply this migration before deploying code that acquires these locks.
CREATE TABLE IF NOT EXISTS public.cron_execution_locks (
  lock_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS cron_execution_locks_expires_at_idx
ON public.cron_execution_locks (expires_at);
`;

  assert.equal(sql, originalSql);
});
