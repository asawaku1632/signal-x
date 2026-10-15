-- Independent SHADOW research: immutable RSI/trend/band-distance factors.
-- Does NOT change 1,424 frozen graded outcomes or prior volume records.
CREATE TABLE IF NOT EXISTS public.bb_asof_factor_attempts (
  batch_id smallint NOT NULL CHECK(batch_id BETWEEN 0 AND 19),
  target_date date NOT NULL,
  codes text[] NOT NULL CHECK(cardinality(codes)=5),
  factor_version text NOT NULL CHECK(factor_version='BB_ASOF_RSI_TREND_STRENGTH_V1'),
  status text NOT NULL DEFAULT 'CLAIMED'
     CHECK(status IN ('CLAIMED','COMPLETED','REJECTED')),
  new_factors integer NOT NULL DEFAULT 0 CHECK(new_factors>=0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY(batch_id,target_date)
);

CREATE TABLE IF NOT EXISTS public.bb_asof_factors (
  detector_version text NOT NULL CHECK(detector_version='BB_BREAKOUT_SHADOW_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL CHECK(signal_time>0),
  original_source_hash text NOT NULL CHECK(original_source_hash ~ '^[0-9a-f]{64}$'),
  factor_version text NOT NULL CHECK(factor_version='BB_ASOF_RSI_TREND_STRENGTH_V1'),
  rsi14 numeric(10,6) NOT NULL CHECK(rsi14 BETWEEN 0 AND 100),
  trend10_percent numeric(14,6) NOT NULL CHECK(trend10_percent BETWEEN -100 AND 100000),
  breakout_strength_percent numeric(14,6) NOT NULL CHECK(breakout_strength_percent>0 AND breakout_strength_percent<=100000),
  rsi_group text NOT NULL CHECK(rsi_group IN ('RSI_70_PLUS','RSI_50_TO_70','RSI_BELOW_50')),
  trend_group text NOT NULL CHECK(trend_group IN ('TREND_UP_5_PLUS','TREND_FLAT_TO_5','TREND_NEGATIVE')),
  breakout_group text NOT NULL CHECK(breakout_group IN ('BREAKOUT_2_PLUS','BREAKOUT_BELOW_2')),
  original_scope text NOT NULL CHECK(original_scope IN ('BASE20','EXPANSION80')),
  batch_id smallint NOT NULL CHECK(batch_id BETWEEN 0 AND 19),
  first_target_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(detector_version,code,signal_time),
  FOREIGN KEY(batch_id,first_target_date)
    REFERENCES public.bb_asof_factor_attempts(batch_id,target_date),
  CONSTRAINT bb_asof_rsi_match CHECK(
   (rsi14>=70 AND rsi_group='RSI_70_PLUS')
   OR (rsi14>=50 AND rsi14<70 AND rsi_group='RSI_50_TO_70')
   OR (rsi14<50 AND rsi_group='RSI_BELOW_50')),
  CONSTRAINT bb_asof_trend_match CHECK(
   (trend10_percent>=5 AND trend_group='TREND_UP_5_PLUS')
   OR (trend10_percent>=0 AND trend10_percent<5 AND trend_group='TREND_FLAT_TO_5')
   OR (trend10_percent<0 AND trend_group='TREND_NEGATIVE')),
  CONSTRAINT bb_asof_breakout_match CHECK(
   (breakout_strength_percent>=2 AND breakout_group='BREAKOUT_2_PLUS')
   OR (breakout_strength_percent<2 AND breakout_group='BREAKOUT_BELOW_2'))
);
CREATE INDEX IF NOT EXISTS bb_asof_factor_groups_idx
 ON public.bb_asof_factors(rsi_group,trend_group,breakout_group);

ALTER TABLE public.bb_asof_factor_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_asof_factors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_asof_factor_attempts,public.bb_asof_factors FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.bb_asof_factor_attempts TO service_role;
GRANT SELECT,INSERT ON public.bb_asof_factors TO service_role;
-- The API only INSERTs immutable factor rows; no automatic processing or existing schema changes.
