-- Dedicated owner-only research scheduler: no impact on production AI or LINE.
-- Feature flag starts DISABLED until verified on production.
CREATE TABLE IF NOT EXISTS public.shadow_candle_auto_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 5 CHECK (daily_limit BETWEEN 1 AND 5),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.shadow_candle_auto_control(singleton,enabled,daily_limit)
VALUES (true,false,5) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shadow_candle_auto_runs (
  run_date date PRIMARY KEY,
  calendar_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('CLAIMED','SAVED','SKIPPED_STALE_BARS','FETCH_FAILED','ARCHIVE_FAILED')),
  codes text[] NOT NULL CHECK (cardinality(codes) BETWEEN 1 AND 5),
  snapshot_updated_at timestamptz NOT NULL,
  archive_id uuid REFERENCES public.shadow_candle_research_runs(id) ON DELETE RESTRICT,
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS shadow_candle_auto_runs_recent_idx
 ON public.shadow_candle_auto_runs (started_at DESC);
ALTER TABLE public.shadow_candle_auto_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadow_candle_auto_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shadow_candle_auto_control FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.shadow_candle_auto_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shadow_candle_auto_control TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.shadow_candle_auto_runs TO service_role;
-- To enable after deployment and owner verification (manual SQL, never from public UI):
-- UPDATE public.shadow_candle_auto_control SET enabled=true, updated_at=now() WHERE singleton=true;
