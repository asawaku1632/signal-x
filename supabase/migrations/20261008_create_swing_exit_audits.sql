-- Recorded once per simulated position when the server verifies an EXIT decision.
-- Private audit data: only privileged server credentials should access this table.
CREATE TABLE IF NOT EXISTS public.swing_exit_audits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paper_trade_id BIGINT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  signal_date DATE NOT NULL,
  signalled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot_at TIMESTAMPTZ NOT NULL,
  signal_price NUMERIC(16,4) NOT NULL CHECK (signal_price > 0),
  entry_price NUMERIC(16,4) NOT NULL CHECK (entry_price > 0),
  ai_power NUMERIC(8,2),
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
  CONSTRAINT swing_exit_1d_pair CHECK ((outcome_1d_date IS NULL) = (outcome_1d_price IS NULL)),
  CONSTRAINT swing_exit_3d_pair CHECK ((outcome_3d_date IS NULL) = (outcome_3d_price IS NULL)),
  CONSTRAINT swing_exit_5d_pair CHECK ((outcome_5d_date IS NULL) = (outcome_5d_price IS NULL)),
  CONSTRAINT swing_exit_10d_pair CHECK ((outcome_10d_date IS NULL) = (outcome_10d_price IS NULL))
);
CREATE INDEX IF NOT EXISTS swing_exit_audits_user_date_idx
  ON public.swing_exit_audits (user_email, signal_date DESC);
CREATE INDEX IF NOT EXISTS swing_exit_audits_pending_idx
  ON public.swing_exit_audits (signal_date DESC) WHERE outcome_10d_price IS NULL;
ALTER TABLE public.swing_exit_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swing_exit_audits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swing_exit_audits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.swing_exit_audits_id_seq TO service_role;
