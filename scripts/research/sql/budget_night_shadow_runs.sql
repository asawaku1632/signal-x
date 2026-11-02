-- Research-only, NOT executed. Apply to the actual DATABASE_URL PostgreSQL
-- only after owner review; not necessarily the separate Supabase dev project.
-- Preserve existing top-five research and all historical data.
CREATE TABLE IF NOT EXISTS public.budget_night_shadow_runs (
  trade_date date PRIMARY KEY,
  prior_date date NOT NULL CHECK (prior_date < trade_date),
  policy_version text NOT NULL CHECK (policy_version='BUDGET_UNIVERSE_NIGHT_FREEZE_V1'),
  frozen_at timestamptz NOT NULL,
  snapshot_hash char(64) NOT NULL CHECK(snapshot_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_universe_snapshot_object CHECK(jsonb_typeof(snapshot)='object')
);
COMMENT ON TABLE public.budget_night_shadow_runs IS
  'Owner-only, immutable-by-application, as-of budget research. Never automatic orders, alerts or live AI. Requires separate operator-enabled capture.';
ALTER TABLE public.budget_night_shadow_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_night_shadow_runs FROM anon, authenticated;
-- No client-readable or writable RLS policy. Only the owner's server-side
-- PostgreSQL role may insert/read. No UPDATE or DELETE operations in app.
