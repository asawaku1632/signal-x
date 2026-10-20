-- Separate as-of preopen-only macro research. Additive and no public grants.
-- One day = one irrevocable capture claim; no fill-in of missed snapshots.
CREATE TABLE IF NOT EXISTS public.morning_market_forward_runs (
  trade_date date PRIMARY KEY,
  policy_version text NOT NULL,
  state text NOT NULL DEFAULT 'CLAIMED'
    CHECK (state IN ('CLAIMED','COMPLETE','PARTIAL','FAILED')),
  claimed_at timestamptz NOT NULL,
  captured_at timestamptz,
  quotes jsonb NOT NULL DEFAULT '{}'::jsonb,
  pts_status text NOT NULL DEFAULT 'UNAVAILABLE'
    CHECK (pts_status = 'UNAVAILABLE'),
  source text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT morning_market_snapshot_before_open CHECK (
    captured_at IS NULL OR captured_at >= claimed_at
  )
);
COMMENT ON TABLE public.morning_market_forward_runs IS
  'Owner-only pre-open market reference snapshot, without PTS source, orders, trade advice or model updates.';
ALTER TABLE public.morning_market_forward_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.morning_market_forward_runs FROM PUBLIC, anon, authenticated;
-- No RLS policy for anonymous/authenticated clients. Server Postgres only.
