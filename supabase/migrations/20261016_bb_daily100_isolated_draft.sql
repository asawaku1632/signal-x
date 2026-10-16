-- Design-only migration for a separate daily 100-stock forward research ledger.
-- NOT applied to any database. Does not modify existing Stage 7 objects.
CREATE TABLE IF NOT EXISTS public.bb_daily100_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT false,
  activation_date date,
  policy_version text NOT NULL DEFAULT 'BB_DAILY_100_V1'
    CHECK(policy_version='BB_DAILY_100_V1'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(NOT enabled OR activation_date IS NOT NULL)
);
INSERT INTO public.bb_daily100_control(singleton,enabled)
 VALUES(true,false) ON CONFLICT(singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.bb_daily100_runs (
  trade_date date NOT NULL,
  partition_id smallint NOT NULL CHECK(partition_id BETWEEN 0 AND 4),
  policy_version text NOT NULL CHECK(policy_version='BB_DAILY_100_V1'),
  codes text[] NOT NULL CHECK(cardinality(codes)=20),
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK(status IN ('CLAIMED','COMPLETE','PARTIAL','FAILED')),
  requested_count integer NOT NULL DEFAULT 20 CHECK(requested_count=20),
  observed_count integer NOT NULL DEFAULT 0 CHECK(observed_count BETWEEN 0 AND 20),
  failed_count integer NOT NULL DEFAULT 0 CHECK(failed_count BETWEEN 0 AND 20),
  new_signals integer NOT NULL DEFAULT 0 CHECK(new_signals BETWEEN 0 AND 20),
  outcome_rows integer NOT NULL DEFAULT 0 CHECK(outcome_rows>=0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  note text,
  PRIMARY KEY(trade_date,partition_id,policy_version),
  CHECK(observed_count+failed_count<=requested_count)
);
CREATE TABLE IF NOT EXISTS public.bb_daily100_checks (
  trade_date date NOT NULL,
  partition_id smallint NOT NULL,
  policy_version text NOT NULL CHECK(policy_version='BB_DAILY_100_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  state text NOT NULL CHECK(state IN ('OK','SOURCE_FAILED','QUALITY_FAILED')),
  note text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(trade_date,policy_version,code),
  FOREIGN KEY(trade_date,partition_id,policy_version)
    REFERENCES public.bb_daily100_runs(trade_date,partition_id,policy_version)
);
CREATE TABLE IF NOT EXISTS public.bb_daily100_signals (
  policy_version text NOT NULL CHECK(policy_version='BB_DAILY_100_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL CHECK(signal_time>0),
  signal_date date NOT NULL,
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
  PRIMARY KEY(policy_version,code,signal_time),
  UNIQUE(policy_version,code,signal_date)
);
CREATE TABLE IF NOT EXISTS public.bb_daily100_outcomes (
  policy_version text NOT NULL CHECK(policy_version='BB_DAILY_100_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL,
  horizon smallint NOT NULL CHECK(horizon IN(1,3,5)),
  status text NOT NULL CHECK(status IN ('COMPLETE','EXCLUDED_SPLIT')),
  entry_time bigint,
  exit_time bigint,
  entry_price numeric(20,6),
  exit_price numeric(20,6),
  return_percent numeric(15,6),
  max_adverse_percent numeric(15,6),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(policy_version,code,signal_time,horizon),
  FOREIGN KEY(policy_version,code,signal_time)
    REFERENCES public.bb_daily100_signals(policy_version,code,signal_time),
  CHECK(
    (status='EXCLUDED_SPLIT' AND entry_time IS NULL AND exit_time IS NULL
      AND entry_price IS NULL AND exit_price IS NULL AND return_percent IS NULL AND max_adverse_percent IS NULL)
    OR
    (status='COMPLETE' AND entry_time>signal_time AND exit_time>=entry_time
      AND entry_price>0 AND exit_price>0 AND return_percent BETWEEN -100 AND 100000
      AND max_adverse_percent BETWEEN -100 AND 100000)
  )
);
CREATE TABLE IF NOT EXISTS public.bb_daily100_halts (
  policy_version text NOT NULL CHECK(policy_version='BB_DAILY_100_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL,
  reason text NOT NULL CHECK(reason IN ('SOURCE_REVISED','HISTORY_EXPIRED','DETECTOR_CHANGED')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(policy_version,code,signal_time),
  FOREIGN KEY(policy_version,code,signal_time)
    REFERENCES public.bb_daily100_signals(policy_version,code,signal_time)
);
CREATE INDEX IF NOT EXISTS bb_daily100_signals_date_idx ON public.bb_daily100_signals(signal_date);
CREATE INDEX IF NOT EXISTS bb_daily100_outcomes_status_idx ON public.bb_daily100_outcomes(status,horizon);

ALTER TABLE public.bb_daily100_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_daily100_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_daily100_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_daily100_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_daily100_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_daily100_halts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_daily100_control, public.bb_daily100_runs,
 public.bb_daily100_checks, public.bb_daily100_signals,
 public.bb_daily100_outcomes, public.bb_daily100_halts FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.bb_daily100_control TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.bb_daily100_runs TO service_role;
GRANT SELECT, INSERT ON public.bb_daily100_checks, public.bb_daily100_signals,
 public.bb_daily100_outcomes, public.bb_daily100_halts TO service_role;
