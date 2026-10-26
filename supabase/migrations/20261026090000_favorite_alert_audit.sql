CREATE TABLE IF NOT EXISTS public.favorite_alert_audit (
  monitor_id text PRIMARY KEY,
  code text NOT NULL,
  quote_timestamp timestamptz NOT NULL,
  snapshot_updated_at timestamptz,
  decision_at timestamptz NOT NULL,
  reference_price numeric NOT NULL,
  ai_power numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.favorite_alert_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.favorite_alert_audit FROM anon, authenticated;
