-- Golden Zone observational samples (admin-only).
-- Applied to signal-x production via Supabase migration create_golden_zone_observations.
CREATE TABLE IF NOT EXISTS public.golden_zone_observations (
  trade_date date NOT NULL,
  time_slot text NOT NULL CHECK (time_slot IN ('09:30','10:30','13:00','14:30')),
  code text NOT NULL,
  name text NOT NULL,
  entry_price numeric NOT NULL CHECK (entry_price > 0),
  ai_power numeric,
  sampled_at timestamptz NOT NULL,
  outcome_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trade_date, time_slot, code),
  CONSTRAINT golden_zone_outcome_after_entry CHECK (outcome_date > trade_date)
);
CREATE INDEX IF NOT EXISTS golden_zone_outcome_date_idx
  ON public.golden_zone_observations (outcome_date, code);
ALTER TABLE public.golden_zone_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.golden_zone_observations FROM anon, authenticated;
COMMENT ON TABLE public.golden_zone_observations IS
'Admin-only observational study. Samples up to 30 high-ranked cached scan stocks at four scheduled JST slots, evaluates next TSE trading day from daily_stock_results. Never alters AI signals or trades.';
