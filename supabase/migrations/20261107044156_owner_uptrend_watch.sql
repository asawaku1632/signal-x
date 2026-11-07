CREATE TABLE public.owner_uptrend_watch (
  owner_email text NOT NULL,
  code text NOT NULL,
  signal_date date NOT NULL,
  name text NOT NULL,
  reasons jsonb NOT NULL,
  state text NOT NULL DEFAULT 'WAITING' CHECK (state IN ('WAITING','CLAIMED','SENT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  notified_at timestamptz,
  observation jsonb,
  PRIMARY KEY(owner_email,code,signal_date)
);
ALTER TABLE public.owner_uptrend_watch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_uptrend_watch FROM PUBLIC,anon,authenticated;
CREATE INDEX owner_uptrend_watch_pending ON public.owner_uptrend_watch(owner_email,state);