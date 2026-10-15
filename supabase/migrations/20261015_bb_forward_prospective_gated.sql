-- Stage 7. Genuine after-deployment prospective SHADOW only.
-- Deployment itself never enables collection; owner must explicitly opt in.
CREATE TABLE IF NOT EXISTS public.bb_forward_study_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton=true),
  enabled boolean NOT NULL DEFAULT false,
  activation_date date,
  policy_version text NOT NULL DEFAULT 'BB_FORWARD_20261016_V1'
    CHECK(policy_version='BB_FORWARD_20261016_V1'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(NOT enabled OR activation_date IS NOT NULL)
);
INSERT INTO public.bb_forward_study_control(singleton,enabled) VALUES(true,false)
 ON CONFLICT(singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.bb_forward_study_runs (
  trade_date date NOT NULL CHECK(trade_date>=DATE '2026-10-16'),
  batch_id smallint NOT NULL CHECK(batch_id BETWEEN 0 AND 4),
  policy_version text NOT NULL CHECK(policy_version='BB_FORWARD_20261016_V1'),
  codes text[] NOT NULL CHECK(cardinality(codes)=20),
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK(status IN ('CLAIMED','COMPLETE','PARTIAL','FAILED')),
  requested_count integer NOT NULL DEFAULT 20 CHECK(requested_count=20),
  observed_count integer NOT NULL DEFAULT 0 CHECK(observed_count BETWEEN 0 AND 20),
  failed_count integer NOT NULL DEFAULT 0 CHECK(failed_count BETWEEN 0 AND 20),
  new_signals integer NOT NULL DEFAULT 0 CHECK(new_signals BETWEEN 0 AND 20),
  outcome_rows integer NOT NULL DEFAULT 0 CHECK(outcome_rows BETWEEN 0 AND 1000),
  note text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY(trade_date,batch_id),
  CHECK(observed_count+failed_count<=requested_count)
);

CREATE TABLE IF NOT EXISTS public.bb_forward_stock_checks (
  trade_date date NOT NULL,
  batch_id smallint NOT NULL,
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  check_state text NOT NULL CHECK(check_state IN ('OK','SOURCE_FAILED','QUALITY_FAILED')),
  note text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(trade_date,code),
  FOREIGN KEY(trade_date,batch_id) REFERENCES public.bb_forward_study_runs(trade_date,batch_id)
);

CREATE TABLE IF NOT EXISTS public.bb_forward_signals (
  version text NOT NULL CHECK(version='BB_FORWARD_20261016_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL CHECK(signal_time>0),
  signal_date date NOT NULL CHECK(signal_date>=DATE '2026-10-16'),
  group_key text NOT NULL CHECK(group_key IN ('SQUEEZE_UP_BREAKOUT','OTHER_UP_BREAKOUT')),
  signal_close numeric(20,6) NOT NULL CHECK(signal_close>0),
  source_hash text NOT NULL CHECK(source_hash ~ '^[0-9a-f]{64}$'),
  calendar_version text NOT NULL,
  rsi_group text NOT NULL,
  trend_group text NOT NULL,
  breakout_group text NOT NULL,
  volume_bucket text NOT NULL CHECK(volume_bucket IN ('HIGH_1_3X','BELOW_1_3X','UNKNOWN')),
  rsi14 numeric(10,6) NOT NULL CHECK(rsi14 BETWEEN 0 AND 100),
  trend10_percent numeric(14,6) NOT NULL,
  breakout_strength_percent numeric(14,6) NOT NULL CHECK(breakout_strength_percent>0),
  volume_ratio numeric(14,6),
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(version,code,signal_time),
  UNIQUE(version,code,signal_date),
  CHECK((volume_bucket='UNKNOWN' AND volume_ratio IS NULL)
     OR (volume_bucket='HIGH_1_3X' AND volume_ratio>=1.3)
     OR (volume_bucket='BELOW_1_3X' AND volume_ratio>=0 AND volume_ratio<1.3))
);

CREATE TABLE IF NOT EXISTS public.bb_forward_outcomes (
  version text NOT NULL CHECK(version='BB_FORWARD_20261016_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL CHECK(signal_time>0),
  horizon smallint NOT NULL CHECK(horizon IN(1,3,5)),
  status text NOT NULL CHECK(status IN('COMPLETE','EXCLUDED_SPLIT')),
  entry_time bigint,
  exit_time bigint,
  entry_price numeric(20,6),
  exit_price numeric(20,6),
  return_percent numeric(15,6),
  max_adverse_percent numeric(15,6),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(version,code,signal_time,horizon),
  FOREIGN KEY(version,code,signal_time)
    REFERENCES public.bb_forward_signals(version,code,signal_time),
  CHECK(
   (status='EXCLUDED_SPLIT' AND entry_price IS NULL AND exit_price IS NULL
    AND return_percent IS NULL AND max_adverse_percent IS NULL AND entry_time IS NULL AND exit_time IS NULL)
   OR
   (status='COMPLETE' AND entry_time>signal_time AND exit_time>=entry_time
    AND entry_price>0 AND exit_price>0 AND return_percent BETWEEN -100 AND 100000
    AND max_adverse_percent BETWEEN -100 AND 100000)
  )
);
CREATE TABLE IF NOT EXISTS public.bb_forward_signal_halts (
  version text NOT NULL CHECK(version='BB_FORWARD_20261016_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4} ON public.bb_forward_outcomes(status,horizon);
CREATE INDEX IF NOT EXISTS bb_forward_signal_date_idx ON public.bb_forward_signals(signal_date);

ALTER TABLE public.bb_forward_study_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_forward_study_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_forward_stock_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_forward_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_forward_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_forward_signal_halts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_forward_study_control,public.bb_forward_study_runs,
 public.bb_forward_stock_checks,public.bb_forward_signals,public.bb_forward_outcomes,
 public.bb_forward_signal_halts FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.bb_forward_study_control TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.bb_forward_study_runs TO service_role;
GRANT SELECT,INSERT ON public.bb_forward_stock_checks,public.bb_forward_signals,
 public.bb_forward_outcomes,public.bb_forward_signal_halts TO service_role;
-- Neither old BB archives nor AI/trades/notification tables are modified.
),
  signal_time bigint NOT NULL,
  reason text NOT NULL CHECK(reason IN ('SOURCE_REVISED','HISTORY_EXPIRED','DETECTOR_CHANGED')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(version,code,signal_time),
  FOREIGN KEY(version,code,signal_time)
    REFERENCES public.bb_forward_signals(version,code,signal_time)
);
CREATE INDEX IF NOT EXISTS bb_forward_outcome_status_idx ON public.bb_forward_outcomes(status,horizon);
CREATE INDEX IF NOT EXISTS bb_forward_signal_date_idx ON public.bb_forward_signals(signal_date);

ALTER TABLE public.bb_forward_study_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_forward_study_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_forward_stock_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_forward_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_forward_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_forward_study_control,public.bb_forward_study_runs,
 public.bb_forward_stock_checks,public.bb_forward_signals,public.bb_forward_outcomes
 FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.bb_forward_study_control TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.bb_forward_study_runs TO service_role;
GRANT SELECT,INSERT ON public.bb_forward_stock_checks,public.bb_forward_signals,
 public.bb_forward_outcomes TO service_role;
-- Neither old BB archives nor AI/trades/notification tables are modified.
