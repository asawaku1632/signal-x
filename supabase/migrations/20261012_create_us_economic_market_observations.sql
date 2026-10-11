-- Read-only research records for US employment and CPI release windows.
-- Separate from AI decisions, user positions, alert delivery and learning results.
CREATE TABLE IF NOT EXISTS public.us_economic_market_observations (
  event_key text NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('employment', 'cpi')),
  scheduled_at timestamptz NOT NULL,
  observation_day_utc date NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  quote_source text NOT NULL DEFAULT 'yahoo-chart-daily-unadjusted',
  market_quotes jsonb NOT NULL CHECK (jsonb_typeof(market_quotes) = 'object'),
  PRIMARY KEY (event_key, observation_day_utc)
);
CREATE INDEX IF NOT EXISTS idx_us_economic_observations_scheduled
  ON public.us_economic_market_observations (scheduled_at DESC, observation_day_utc DESC);

ALTER TABLE public.us_economic_market_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.us_economic_market_observations FROM anon, authenticated;
COMMENT ON TABLE public.us_economic_market_observations IS
  'Immutable daily reference closes around BLS employment/CPI scheduled releases. Snapshot timestamps and quote trading dates retained; no trade, alert or AI-score changes.';
