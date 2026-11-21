-- Private forward-only snapshots of the first HOLD or EXIT decision per position/day/cohort.
-- Research only: no order execution, notifications, or changes to swing decisions.
CREATE TABLE IF NOT EXISTS public.swing_decision_forward_observations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paper_trade_id BIGINT NOT NULL,
  user_email TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  signal_date DATE NOT NULL,
  cohort TEXT NOT NULL CHECK (cohort IN ('MANUAL', 'CRON')),
  decision_status TEXT NOT NULL CHECK (decision_status IN ('HOLD', 'EXIT')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot_at TIMESTAMPTZ NOT NULL,
  signal_price NUMERIC(16,4) NOT NULL CHECK (signal_price > 0),
  entry_price NUMERIC(16,4) NOT NULL CHECK (entry_price > 0),
  ai_power NUMERIC(8,2) NOT NULL CHECK (ai_power BETWEEN 0 AND 100),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  rule_version TEXT NOT NULL DEFAULT 'swing_decision_v1',
  outcome_1d_date DATE,
  outcome_1d_price NUMERIC(16,4) CHECK (outcome_1d_price > 0),
  outcome_3d_date DATE,
  outcome_3d_price NUMERIC(16,4) CHECK (outcome_3d_price > 0),
  outcome_5d_date DATE,
  outcome_5d_price NUMERIC(16,4) CHECK (outcome_5d_price > 0),
  outcome_10d_date DATE,
  outcome_10d_price NUMERIC(16,4) CHECK (outcome_10d_price > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (paper_trade_id, signal_date, cohort),
  CONSTRAINT sdf_1d_pair CHECK ((outcome_1d_date IS NULL) = (outcome_1d_price IS NULL)),
  CONSTRAINT sdf_3d_pair CHECK ((outcome_3d_date IS NULL) = (outcome_3d_price IS NULL)),
  CONSTRAINT sdf_5d_pair CHECK ((outcome_5d_date IS NULL) = (outcome_5d_price IS NULL)),
  CONSTRAINT sdf_10d_pair CHECK ((outcome_10d_date IS NULL) = (outcome_10d_price IS NULL))
);
CREATE INDEX IF NOT EXISTS sdf_user_date_idx
  ON public.swing_decision_forward_observations (user_email, signal_date DESC);
CREATE INDEX IF NOT EXISTS sdf_pending_idx
  ON public.swing_decision_forward_observations (signal_date, id)
  WHERE outcome_10d_price IS NULL;
ALTER TABLE public.swing_decision_forward_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swing_decision_forward_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swing_decision_forward_observations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.swing_decision_forward_observations_id_seq TO service_role;
