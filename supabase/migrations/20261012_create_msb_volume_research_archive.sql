-- Append-only owner-only MSB/OB + breakout-volume retrospective research archive.
-- Does not touch existing scans, learning, paper trades, LINE, or cron.
CREATE TABLE IF NOT EXISTS public.msb_volume_research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detector_version text NOT NULL CHECK (detector_version='shadow_msb_ob_ma525_v1'),
  volume_version text NOT NULL CHECK (volume_version='shadow_msb_volume_sensitivity_v1'),
  input_hash text NOT NULL UNIQUE CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  codes text[] NOT NULL CHECK (cardinality(codes) BETWEEN 1 AND 5),
  first_bar_date date NOT NULL,
  last_bar_date date NOT NULL CHECK (last_bar_date >= first_bar_date),
  base_count integer NOT NULL CHECK (base_count >= 0),
  ob_count integer NOT NULL CHECK (ob_count >= 0),
  source text NOT NULL DEFAULT 'YAHOO_CHART_1D' CHECK (source='YAHOO_CHART_1D'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS msb_volume_runs_created_idx
  ON public.msb_volume_research_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.msb_volume_research_observations (
  detector_version text NOT NULL CHECK (detector_version='shadow_msb_ob_ma525_v1'),
  volume_version text NOT NULL CHECK (volume_version='shadow_msb_volume_sensitivity_v1'),
  code text NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL CHECK (signal_time > 0),
  entry_time bigint NOT NULL CHECK (entry_time > signal_time),
  exit_time bigint NOT NULL CHECK (exit_time > entry_time),
  profit_yen_100 integer NOT NULL,
  return_percent numeric(12,4) NOT NULL CHECK (return_percent BETWEEN -100000 AND 100000),
  volume_eligible boolean NOT NULL,
  ob_eligible boolean NOT NULL,
  breakout_ratio numeric(15,6) NULL CHECK (breakout_ratio >= 0),
  retest_ratio numeric(15,6) NULL CHECK (retest_ratio >= 0),
  first_run_id uuid NOT NULL REFERENCES public.msb_volume_research_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (detector_version, volume_version, code, signal_time),
  CONSTRAINT msb_volume_ob_ratio CHECK
    (ob_eligible OR (breakout_ratio IS NULL AND retest_ratio IS NULL))
);
CREATE INDEX IF NOT EXISTS msb_volume_observations_exit_idx
  ON public.msb_volume_research_observations(detector_version,exit_time,code);

ALTER TABLE public.msb_volume_research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msb_volume_research_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.msb_volume_research_runs, public.msb_volume_research_observations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.msb_volume_research_runs, public.msb_volume_research_observations
  TO service_role;
-- No UPDATE/DELETE application rights. On conflict preserve the first frozen historical result.
