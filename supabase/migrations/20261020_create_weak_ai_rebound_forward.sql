-- Fully isolated prospective reversal study; no modifications to existing learning,
-- swing universe, paper trades, ranking, notification or order tables.
CREATE TABLE IF NOT EXISTS public.weak_ai_rebound_runs (
  entry_date date PRIMARY KEY,
  source_date date NOT NULL CHECK (source_date < entry_date),
  rule_version text NOT NULL,
  cohort jsonb NOT NULL CHECK (jsonb_typeof(cohort)='array'),
  frozen_at timestamptz NOT NULL DEFAULT now(),
  entry_state text NOT NULL DEFAULT 'PENDING'
    CHECK(entry_state IN ('PENDING','CLAIMED','COMPLETE','PARTIAL','FAILED')),
  entry_claimed_at timestamptz,
  entry_finished_at timestamptz,
  note text
);
CREATE TABLE IF NOT EXISTS public.weak_ai_rebound_positions (
  entry_date date NOT NULL REFERENCES public.weak_ai_rebound_runs(entry_date) ON DELETE RESTRICT,
  source_date date NOT NULL,
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  name text NOT NULL,
  rank smallint NOT NULL CHECK(rank BETWEEN 1 AND 5),
  ai_power numeric(7,2) NOT NULL CHECK(ai_power >= 0 AND ai_power < 55),
  ai_bucket text NOT NULL CHECK(ai_bucket IN ('0–19','20–39','40–54')),
  prior_price numeric(16,4) NOT NULL CHECK(prior_price>0),
  entry_status text NOT NULL DEFAULT 'PENDING'
    CHECK(entry_status IN ('PENDING','COMPLETE','UNAVAILABLE')),
  entry_price numeric(16,4) CHECK(entry_price>0),
  close_price numeric(16,4) CHECK(close_price>0),
  same_day_return numeric(12,4),
  max_adverse_pct numeric(12,4),
  max_favorable_pct numeric(12,4),
  gap_pct numeric(12,4),
  open5_move_pct numeric(12,4),
  open5_range_pct numeric(12,4),
  entry_reason text,
  entry_saved_at timestamptz,
  outcome_1d_date date,
  return_1d numeric(12,4),
  outcome_3d_date date,
  return_3d numeric(12,4),
  outcome_5d_date date,
  return_5d numeric(12,4),
  outcome_10d_date date,
  return_10d numeric(12,4),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(entry_date,code),
  UNIQUE(entry_date,rank),
  CHECK((entry_status='COMPLETE')=(entry_price IS NOT NULL)),
  CHECK((outcome_1d_date IS NULL)=(return_1d IS NULL)),
  CHECK((outcome_3d_date IS NULL)=(return_3d IS NULL)),
  CHECK((outcome_5d_date IS NULL)=(return_5d IS NULL)),
  CHECK((outcome_10d_date IS NULL)=(return_10d IS NULL))
);
CREATE INDEX IF NOT EXISTS weak_ai_rebound_pending_idx
  ON public.weak_ai_rebound_positions(entry_date)
  WHERE outcome_10d_date IS NULL;
CREATE INDEX IF NOT EXISTS weak_ai_rebound_bucket_date_idx
  ON public.weak_ai_rebound_positions(ai_bucket,entry_date DESC);
ALTER TABLE public.weak_ai_rebound_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weak_ai_rebound_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weak_ai_rebound_runs,public.weak_ai_rebound_positions
  FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.weak_ai_rebound_runs,public.weak_ai_rebound_positions
  TO service_role;
COMMENT ON TABLE public.weak_ai_rebound_runs IS 'Owner-only forward weak AI proxy <55, five stocks per night; NOT position-dependent EXIT';
COMMENT ON TABLE public.weak_ai_rebound_positions IS '09:10 hypothetical reference from archived 5-minute OHLC and future daily saved prices. No real trades';
