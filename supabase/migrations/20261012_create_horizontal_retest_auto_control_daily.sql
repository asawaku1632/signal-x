-- Independent, owner-controlled daily horizontal research only.
-- Existing portfolio, learning, LINE, production AI and candle research untouched.
CREATE TABLE IF NOT EXISTS public.horizontal_retest_auto_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id=true),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.horizontal_retest_auto_control (id, enabled)
VALUES (true, false) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.horizontal_retest_auto_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.horizontal_retest_auto_control FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.horizontal_retest_auto_control TO service_role;

-- Claim before fetching market data; PK prevents concurrent/double cron retries.
-- FAILED days remain consumed; limit of five new code lookups per JST trading date.
CREATE TABLE IF NOT EXISTS public.horizontal_retest_auto_daily_runs (
  trade_date date PRIMARY KEY,
  detector_version text NOT NULL CHECK (detector_version = 'shadow_horizontal_compare_v1'),
  codes text[] NOT NULL CHECK (cardinality(codes) BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK (status IN ('CLAIMED', 'COMPLETED', 'FAILED')),
  archive_run_id uuid NULL REFERENCES public.horizontal_retest_archive_runs(id),
  note text NULL CHECK (char_length(note) <= 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS horizontal_retest_auto_daily_created_idx
  ON public.horizontal_retest_auto_daily_runs (created_at DESC);
ALTER TABLE public.horizontal_retest_auto_daily_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.horizontal_retest_auto_daily_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.horizontal_retest_auto_daily_runs TO service_role;
-- No DELETE on either table. No trigger or background DB job.
