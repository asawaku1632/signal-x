-- Stage 3: volume confirmation research only. No changes to frozen Stage 2 results.
-- A separate once-per-target-date claim limits vendor fetches before any request.
CREATE TABLE IF NOT EXISTS public.bb_breakout_volume_attempts (
  batch_id smallint NOT NULL CHECK(batch_id BETWEEN 0 AND 3),
  target_date date NOT NULL,
  codes text[] NOT NULL CHECK(cardinality(codes)=5),
  version text NOT NULL CHECK(version='BB_VOLUME_SHADOW_V1'),
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK(status IN ('CLAIMED','COMPLETE','REJECTED','FAILED')),
  saved_count integer NOT NULL DEFAULT 0 CHECK(saved_count>=0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY(batch_id,target_date)
);
CREATE TABLE IF NOT EXISTS public.bb_breakout_volume_factors (
  detector_version text NOT NULL CHECK(detector_version='BB_BREAKOUT_SHADOW_V1'),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL CHECK(signal_time>0),
  horizon smallint NOT NULL DEFAULT 1 CHECK(horizon=1),
  original_source_hash text NOT NULL CHECK(original_source_hash ~ '^[0-9a-f]{64}$'),
  volume_ratio numeric(14,6) CHECK(volume_ratio>=0 AND volume_ratio<=100000),
  volume_bucket text NOT NULL CHECK(volume_bucket IN ('HIGH_1_3X','BELOW_1_3X','UNKNOWN')),
  metric_version text NOT NULL CHECK(metric_version='BB_VOLUME_SHADOW_V1'),
  batch_id smallint NOT NULL CHECK(batch_id BETWEEN 0 AND 3),
  first_target_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(detector_version,code,signal_time),
  FOREIGN KEY(detector_version,code,signal_time,horizon)
    REFERENCES public.bb_breakout_shadow_outcomes(detector_version,code,signal_time,horizon),
  FOREIGN KEY(batch_id,first_target_date)
    REFERENCES public.bb_breakout_volume_attempts(batch_id,target_date),
  CONSTRAINT bb_volume_bucket_matches_ratio CHECK(
    (volume_ratio IS NULL AND volume_bucket='UNKNOWN') OR
    (volume_ratio IS NOT NULL AND
       ((volume_ratio>=1.3 AND volume_bucket='HIGH_1_3X') OR
        (volume_ratio<1.3 AND volume_bucket='BELOW_1_3X')))
  )
);
CREATE INDEX IF NOT EXISTS bb_breakout_volume_bucket_idx
  ON public.bb_breakout_volume_factors(volume_bucket,code,signal_time);

ALTER TABLE public.bb_breakout_volume_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_breakout_volume_factors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_breakout_volume_attempts,public.bb_breakout_volume_factors
 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.bb_breakout_volume_attempts TO service_role;
GRANT SELECT,INSERT ON public.bb_breakout_volume_factors TO service_role;
-- No application UPDATE / DELETE of frozen factor rows; PostgreSQL owner-only server access.
