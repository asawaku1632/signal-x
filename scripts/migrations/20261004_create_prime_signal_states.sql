CREATE TABLE IF NOT EXISTS public.prime_signal_states (
  code TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'ARMED' CHECK (state IN ('ARMED', 'HOT')),
  last_score DOUBLE PRECISION,
  last_notified_at TIMESTAMPTZ,
  notification_claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prime_signal_states_updated_at_idx
  ON public.prime_signal_states (updated_at DESC);

ALTER TABLE public.prime_signal_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.prime_signal_states FROM anon, authenticated;
