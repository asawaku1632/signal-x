-- SHADOW-only expansion for 80 additional symbols / 16 fixed five-stock groups.
-- Keeps BOTH earlier 20-symbol tables and all their frozen rows UNCHANGED.
CREATE TABLE IF NOT EXISTS public.bb_breakout_expansion_attempts (
  batch_id smallint NOT NULL CHECK(batch_id BETWEEN 4 AND 19),
  target_date date NOT NULL,
  codes text[] NOT NULL CHECK(cardinality(codes)=5),
  policy_version text NOT NULL CHECK(policy_version='BB_BREAKOUT_100_EXT_V1'),
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK(status IN ('CLAIMED','COMPLETE','REJECTED','FAILED')),
  saved_outcomes integer NOT NULL DEFAULT 0 CHECK(saved_outcomes>=0),
  saved_signals integer NOT NULL DEFAULT 0 CHECK(saved_signals>=0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY(batch_id,target_date)
);
CREATE INDEX IF NOT EXISTS bb_breakout_expansion_attempts_created_idx
 ON public.bb_breakout_expansion_attempts(target_date DESC,batch_id);

CREATE TABLE IF NOT EXISTS public.bb_breakout_expansion_outcomes (
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
  volume_ratio numeric(14,6) CHECK(volume_ratio BETWEEN 0 AND 100000),
  volume_bucket text NOT NULL CHECK(volume_bucket IN ('HIGH_1_3X','BELOW_1_3X','UNKNOWN')),
  source_hash text NOT NULL CHECK(source_hash ~ '^[0-9a-f]{64}$'),
  calendar_version text NOT NULL,
  batch_id smallint NOT NULL CHECK(batch_id BETWEEN 4 AND 19),
  first_target_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(detector_version,code,signal_time,horizon),
  FOREIGN KEY(batch_id,first_target_date)
    REFERENCES public.bb_breakout_expansion_attempts(batch_id,target_date),
  CONSTRAINT bb_expansion_volume_bucket_rule CHECK(
    (volume_ratio IS NULL AND volume_bucket='UNKNOWN')
    OR (volume_ratio IS NOT NULL AND
      ((volume_ratio>=1.3 AND volume_bucket='HIGH_1_3X')
       OR (volume_ratio<1.3 AND volume_bucket='BELOW_1_3X')))
  ),
  CONSTRAINT bb_expansion_next_day_rule CHECK
    (horizon=1 OR next_day_return_inside IS NULL)
);
CREATE INDEX IF NOT EXISTS bb_breakout_expansion_outcomes_group_idx
 ON public.bb_breakout_expansion_outcomes(group_key,volume_bucket,horizon);

ALTER TABLE public.bb_breakout_expansion_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_breakout_expansion_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_breakout_expansion_attempts,
  public.bb_breakout_expansion_outcomes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.bb_breakout_expansion_attempts TO service_role;
GRANT SELECT,INSERT ON public.bb_breakout_expansion_outcomes TO service_role;
-- Frozen results are append-only through the application; no UPDATE/DELETE grant.
