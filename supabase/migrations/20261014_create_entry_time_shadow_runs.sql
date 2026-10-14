-- Research-only; no FK or triggers to scoring, learning, simulated trades or alerts.
-- A single claimed JST market date enforces a maximum of 5 Yahoo 5m requests/day.
CREATE TABLE IF NOT EXISTS public.entry_time_shadow_runs (
  trade_date date PRIMARY KEY,
  prior_date date NOT NULL,
  policy_version text NOT NULL,
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK (status IN ('CLAIMED','COMPLETE','PARTIAL','FAILED')),
  cohort jsonb NOT NULL DEFAULT '[]'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
COMMENT ON TABLE public.entry_time_shadow_runs IS
  'Owner-only shadow backtest for same prior-night candidates at six entry times; not a trading signal';
