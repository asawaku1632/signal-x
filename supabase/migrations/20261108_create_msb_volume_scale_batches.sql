-- Isolated MSB backtest scale-out. Does not modify the existing horizontal
-- control, Cron scheduling, production scans, trades, or notifications.
-- Explicit opt-in: off + 0 batches until a reviewed release is deployed.
CREATE TABLE IF NOT EXISTS public.msb_volume_scale_control (
  id boolean PRIMARY KEY DEFAULT true CHECK(id=true),
  enabled boolean NOT NULL DEFAULT false,
  extra_batches smallint NOT NULL DEFAULT 0 CHECK(extra_batches BETWEEN 0 AND 9),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.msb_volume_scale_control(id,enabled,extra_batches)
VALUES(true,false,0) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.msb_volume_scale_batches (
  trade_date date NOT NULL,
  batch_no smallint NOT NULL CHECK(batch_no BETWEEN 1 AND 9),
  codes text[] NOT NULL CHECK(cardinality(codes) BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK(status IN ('CLAIMED','COMPLETED','FAILED')),
  archive_run_id uuid REFERENCES public.msb_volume_research_runs(id),
  note text CHECK(length(note)<=160),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY(trade_date,batch_no)
);
CREATE INDEX IF NOT EXISTS msb_volume_scale_recent_idx
  ON public.msb_volume_scale_batches(trade_date DESC,batch_no);

ALTER TABLE public.msb_volume_scale_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msb_volume_scale_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.msb_volume_scale_control,public.msb_volume_scale_batches
  FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.msb_volume_scale_control TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.msb_volume_scale_batches TO service_role;
-- Failures remain claimed/failed for the day, no DELETE or automatic retry.
