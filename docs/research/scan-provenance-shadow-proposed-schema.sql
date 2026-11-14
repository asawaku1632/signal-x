-- Research proposal only. NEVER run against production without review.
-- The development project has a separate *test* table in a private schema.
-- In the development project, scan_provenance_research.shadow_capture_test was
-- provisioned by migration research_scan_provenance_isolated_writer_test_20261114.
-- This file documents the target design; it does not apply migrations.
--
-- Keep this schema PRIVATE and do not expose via Supabase Data API.
-- Use a separate writer connection. Never reuse the app DATABASE_URL.
CREATE SCHEMA IF NOT EXISTS scan_provenance_research;
REVOKE ALL ON SCHEMA scan_provenance_research FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS scan_provenance_research.shadow_capture_test (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_key text NOT NULL,
  scan_generated_at timestamptz NOT NULL,
  code text NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  input_fingerprint_sha256 text NOT NULL CHECK (input_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  capture jsonb NOT NULL,
  UNIQUE(snapshot_key,scan_generated_at,code)
);
ALTER TABLE scan_provenance_research.shadow_capture_test ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON scan_provenance_research.shadow_capture_test FROM PUBLIC, anon, authenticated, service_role;

-- Create a separately owned, non-bypass writer role, not an application admin.
-- The dev project currently has scan_provenance_writer NOLOGIN.
-- It cannot log in or be assumed through the Supabase inspection connection.
-- A secure, separately reviewed LOGIN credential is still needed for an end-to-end test.
-- Avoid placing passwords, database URLs or credentials in this file.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scan_provenance_writer') THEN
    CREATE ROLE scan_provenance_writer NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA scan_provenance_research TO scan_provenance_writer;
GRANT INSERT ON scan_provenance_research.shadow_capture_test TO scan_provenance_writer;
GRANT USAGE ON SEQUENCE scan_provenance_research.shadow_capture_test_id_seq TO scan_provenance_writer;
CREATE POLICY shadow_writer_insert ON scan_provenance_research.shadow_capture_test
  FOR INSERT TO scan_provenance_writer WITH CHECK (true);

-- No SELECT/UPDATE/DELETE/TRUNCATE grant or policy for the writer.
-- ON CONFLICT DO NOTHING prevents duplicate writes only if table constraints
-- and permissions permit execution. Verify via actual credentials before enabling.
-- The existing development test table lacks captured_at; it is a test fixture,
-- not a complete production retention or immutable audit schema.
