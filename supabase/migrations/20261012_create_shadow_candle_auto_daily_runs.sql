-- Safe, one-attempt-per-TSE-trading-day ledger for isolated nine-candle research.
-- Separate from production signals, trading, daily learning, and LINE.
-- The primary key prevents duplicate runs even if the Cron platform retries.
CREATE TABLE IF NOT EXISTS public.shadow_candle_auto_daily_runs (
  trade_date date PRIMARY KEY,
  detector_version text NOT NULL CHECK (detector_version ~ '^CANDLE9_V[0-9]+$'),
  codes text[] NOT NULL CHECK (cardinality(codes) BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK (status IN ('CLAIMED', 'COMPLETED', 'FAILED')),
  archive_run_id uuid NULL REFERENCES public.shadow_candle_research_runs(id),
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS shadow_candle_auto_daily_created_idx
  ON public.shadow_candle_auto_daily_runs (created_at DESC);
ALTER TABLE public.shadow_candle_auto_daily_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shadow_candle_auto_daily_runs FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.shadow_candle_auto_daily_runs TO service_role;
-- Never delete the claim after a failure; retry would bypass the five-call daily cap.
-- This is a single new research-only table. Archive remains append-only.
