-- Owner-only MSB/OB daily research switch, independent of the horizontal switch.
-- Cron schedule and provider are shared; OFF prevents all MSB-auto writes or fetches.
-- This migration changes NO production scoring, trade, notification or preexisting table.
CREATE TABLE IF NOT EXISTS public.msb_volume_auto_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id=true),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.msb_volume_auto_control(id,enabled)
VALUES(true,false) ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.msb_volume_auto_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.msb_volume_auto_control FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.msb_volume_auto_control TO service_role;

-- Fail closed, one claim per JST trading day. No retries or deletes.
CREATE TABLE IF NOT EXISTS public.msb_volume_auto_daily_runs (
  trade_date date PRIMARY KEY,
  codes text[] NOT NULL CHECK(cardinality(codes) BETWEEN 1 AND 5),
  mode text NOT NULL CHECK(mode IN ('SHARED','SOLO')),
  status text NOT NULL DEFAULT 'CLAIMED' CHECK(status IN ('CLAIMED','COMPLETED','FAILED')),
  archive_run_id uuid NULL REFERENCES public.msb_volume_research_runs(id),
  note text NULL CHECK(char_length(note)<=160),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS msb_volume_auto_daily_recent_idx
  ON public.msb_volume_auto_daily_runs(trade_date DESC);
ALTER TABLE public.msb_volume_auto_daily_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.msb_volume_auto_daily_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.msb_volume_auto_daily_runs TO service_role;
-- No trigger, new Cron, update/delete permission on MSB historical results.
