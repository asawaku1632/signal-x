-- Append-only audit of independently captured scan evaluations.
-- Historical rows cannot be reconstructed from the overwritten display snapshot.
CREATE TABLE IF NOT EXISTS public.ai_power_scan_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  snapshot_key text NOT NULL,
  scan_generated_at timestamptz,
  code text NOT NULL,
  ai_power numeric,
  rank integer,
  reference_price numeric,
  latest_bar_timestamp text,
  source_label text NOT NULL DEFAULT 'scan_snapshot',
  model_version text,
  snapshot_coverage integer,
  UNIQUE (snapshot_key, scan_generated_at, code)
);
CREATE INDEX IF NOT EXISTS ai_power_scan_audit_code_time_idx
  ON public.ai_power_scan_audit (code, captured_at DESC);
REVOKE ALL ON public.ai_power_scan_audit FROM anon, authenticated;
ALTER TABLE public.ai_power_scan_audit ENABLE ROW LEVEL SECURITY;
