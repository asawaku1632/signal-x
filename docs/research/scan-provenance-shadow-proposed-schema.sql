-- Proposed schema only. NOT deployed by this PR.
-- Provision in a reviewed migration before setting SCAN_PROVENANCE_SHADOW_ENABLED=true.
CREATE TABLE IF NOT EXISTS public.ai_power_scan_provenance_shadow (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  snapshot_key text NOT NULL,
  scan_generated_at timestamptz NOT NULL,
  code text NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  input_fingerprint_sha256 text NOT NULL CHECK (input_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  capture jsonb NOT NULL,
  UNIQUE (snapshot_key, scan_generated_at, code)
);
CREATE INDEX IF NOT EXISTS ai_power_scan_provenance_shadow_code_time_idx
  ON public.ai_power_scan_provenance_shadow (code, scan_generated_at DESC);
REVOKE ALL ON public.ai_power_scan_provenance_shadow FROM anon, authenticated;
ALTER TABLE public.ai_power_scan_provenance_shadow ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies. Only trusted server-side database roles may write.
-- Never enable the feature flag before this schema is reviewed and deployed.

-- Security review (2026-11-14): existing ai_power_scan_audit has RLS enabled,
-- no anon/authenticated SELECT/INSERT privileges, but service_role holds
-- UPDATE/DELETE privileges. Therefore ON CONFLICT DO NOTHING alone does NOT
-- establish database-level immutability. Before activation, verify the exact
-- server database role and enforce write-once semantics (e.g. deny UPDATE/DELETE
-- to the writer role and use a separately controlled owner for migrations).
-- Do not claim tamper-proof historical records until this is verified.
