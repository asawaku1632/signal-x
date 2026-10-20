-- Separate additive research-only table; no hooks, FKs, orders or production AI mutations.
-- Rows only exist after an actual previous-night freeze. No hindsight reconstruction.
CREATE TABLE IF NOT EXISTS public.morning_final_check_runs (
  trade_date date PRIMARY KEY,
  prior_date date NOT NULL CHECK (prior_date < trade_date),
  policy_version text NOT NULL,
  cohort jsonb NOT NULL DEFAULT '[]'::jsonb,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  morning_state text NOT NULL DEFAULT 'PENDING'
    CHECK (morning_state IN ('PENDING','CLAIMED','COMPLETE','PARTIAL','FAILED')),
  morning_observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  morning_claimed_at timestamptz,
  morning_saved_at timestamptz,
  closing_state text NOT NULL DEFAULT 'PENDING'
    CHECK (closing_state IN ('PENDING','CLAIMED','COMPLETE','PARTIAL','FAILED')),
  closing_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  closing_saved_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.morning_final_check_runs IS
 'Owner-only forward research: one frozen prior-night cohort and irreversible time-gated 09:05 decisions, evaluated against separately archived 16:45 closes. Never an order recommendation.';
ALTER TABLE public.morning_final_check_runs ENABLE ROW LEVEL SECURITY;
-- No client-readable RLS policies. Server-side Postgres credentials alone can access the archive.
