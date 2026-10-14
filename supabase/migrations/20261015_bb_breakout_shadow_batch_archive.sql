-- Owner-only Bollinger breakout shadow HISTORICAL STUDY archive.
-- Isolated: does not alter existing BB/event/scoring/notification/cron tables.
-- The attempt ledger enforces <=1 provider attempt per cohort per target session.
CREATE TABLE IF NOT EXISTS public.bb_breakout_shadow_batch_attempts (
  batch_id smallint NOT NULL CHECK (batch_id BETWEEN 0 AND 3),
  target_date date NOT NULL,
  codes text[] NOT NULL CHECK (cardinality(codes)=5),
  policy_version text NOT NULL CHECK (policy_version='BB_BREAKOUT_BATCH20_V1'),
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK (status IN ('CLAIMED','COMPLETED','DATA_REJECTED','FAILED')),
  new_outcomes integer NOT NULL DEFAULT 0 CHECK (new_outcomes >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY (batch_id,target_date)
);
CREATE INDEX IF NOT EXISTS bb_breakout_shadow_attempts_created_idx
 ON public.bb_breakout_shadow_batch_attempts(created_at DESC);

CREATE TABLE IF NOT EXISTS public.bb_breakout_shadow_outcomes (
  detector_version text NOT NULL CHECK(detector_version='BB_BREAKOUT_SHADOW_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL CHECK(signal_time>0),
  horizon smallint NOT NULL CHECK(horizon IN (1,3,5)),
  group_key text NOT NULL CHECK(group_key IN ('SQUEEZE_UP_BREAKOUT','OTHER_UP_BREAKOUT')),
  signal_close numeric(20,6) NOT NULL CHECK(signal_close>0),
  entry_price numeric(20,6) NOT NULL CHECK(entry_price>0),
  exit_price numeric(20,6) NOT NULL CHECK(exit_price>0),
  return_percent numeric(15,6) NOT NULL CHECK(return_percent BETWEEN -100 AND 100000),
  max_adverse_percent numeric(15,6) NOT NULL CHECK(max_adverse_percent BETWEEN -100 AND 100000),
  next_day_return_inside boolean,
  source_hash text NOT NULL CHECK(source_hash ~ '^[0-9a-f]{64}$'),
  calendar_version text NOT NULL,
  batch_id smallint NOT NULL,
  first_target_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(detector_version,code,signal_time,horizon),
  FOREIGN KEY (batch_id,first_target_date)
    REFERENCES public.bb_breakout_shadow_batch_attempts(batch_id,target_date),
  CONSTRAINT bb_breakout_nextday_guard CHECK
    (horizon=1 OR next_day_return_inside IS NULL)
);
CREATE INDEX IF NOT EXISTS bb_breakout_shadow_outcomes_group_idx
  ON public.bb_breakout_shadow_outcomes(group_key,horizon,signal_time);

ALTER TABLE public.bb_breakout_shadow_batch_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_breakout_shadow_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_breakout_shadow_batch_attempts,
 public.bb_breakout_shadow_outcomes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.bb_breakout_shadow_batch_attempts TO service_role;
GRANT SELECT,INSERT ON public.bb_breakout_shadow_outcomes TO service_role;
-- No anonymous or authenticated data API policies. Never UPDATE frozen outcomes.
