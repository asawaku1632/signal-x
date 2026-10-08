-- Independent, immutable after-the-fact audit of AI POWER-only entry decisions.
-- This table is deliberately separate from user paper trades and live model weights.
CREATE TABLE IF NOT EXISTS public.swing_universe_observations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trade_date DATE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  entry_price NUMERIC(16,4) NOT NULL CHECK (entry_price > 0),
  ai_power NUMERIC(7,2) NOT NULL CHECK (ai_power BETWEEN 0 AND 100),
  decision_status TEXT NOT NULL CHECK (decision_status IN ('CANDIDATE','WAIT','WATCH','AVOID')),
  decision_label TEXT NOT NULL,
  rule_version TEXT NOT NULL DEFAULT 'ai_power_only_v1',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome_1d_date DATE,
  return_1d NUMERIC(12,4),
  outcome_3d_date DATE,
  return_3d NUMERIC(12,4),
  outcome_5d_date DATE,
  return_5d NUMERIC(12,4),
  outcome_10d_date DATE,
  return_10d NUMERIC(12,4),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_date, code),
  CONSTRAINT swing_universe_1d_pair CHECK ((outcome_1d_date IS NULL) = (return_1d IS NULL)),
  CONSTRAINT swing_universe_3d_pair CHECK ((outcome_3d_date IS NULL) = (return_3d IS NULL)),
  CONSTRAINT swing_universe_5d_pair CHECK ((outcome_5d_date IS NULL) = (return_5d IS NULL)),
  CONSTRAINT swing_universe_10d_pair CHECK ((outcome_10d_date IS NULL) = (return_10d IS NULL))
);
CREATE INDEX IF NOT EXISTS swing_universe_outcomes_pending_idx
  ON public.swing_universe_observations (trade_date)
  WHERE outcome_10d_date IS NULL;
CREATE INDEX IF NOT EXISTS swing_universe_status_date_idx
  ON public.swing_universe_observations (decision_status, trade_date DESC);
CREATE INDEX IF NOT EXISTS swing_universe_code_date_idx
  ON public.swing_universe_observations (code, trade_date DESC);
ALTER TABLE public.swing_universe_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.swing_universe_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.swing_universe_observations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.swing_universe_observations_id_seq TO service_role;
