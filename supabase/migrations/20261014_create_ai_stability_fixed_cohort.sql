-- Archived prior-session cohort; additive / shadow-only, not used by AI scoring,
-- trading, simulated positions or notifications.
CREATE TABLE IF NOT EXISTS public.ai_judgment_fixed_cohort_observations (
  trade_date date NOT NULL,
  time_slot text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  prior_date date NOT NULL,
  prior_rank smallint NOT NULL CHECK (prior_rank BETWEEN 1 AND 5),
  prior_score numeric NOT NULL,
  ai_power numeric NOT NULL CHECK (ai_power BETWEEN 0 AND 100),
  entry_price numeric NOT NULL CHECK (entry_price > 0),
  quote_timestamp timestamptz NOT NULL,
  snapshot_saved_at timestamptz NOT NULL,
  outcome_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trade_date,time_slot,code),
  CHECK (time_slot IN ('09:15','09:30','10:30','12:40','13:00','14:30','15:15')),
  CHECK (prior_date < trade_date),
  CHECK (outcome_date > trade_date)
);
CREATE INDEX IF NOT EXISTS idx_ai_stability_fixed_day_code
  ON public.ai_judgment_fixed_cohort_observations (trade_date DESC,code);
COMMENT ON TABLE public.ai_judgment_fixed_cohort_observations
  IS 'SHADOW ONLY: same prior-day top-5 candidates at scheduled market scan slots. Historical rows never backfilled.';
