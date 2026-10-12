-- Isolated horizontal-retest research archive only. No production triggers,
-- cron, LINE, AI POWER, paper trades or alterations to existing tables.
-- An explicit owner-only server action is the only application writer.
CREATE TABLE IF NOT EXISTS public.horizontal_retest_archive_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detector_version text NOT NULL CHECK (detector_version = 'shadow_horizontal_compare_v1'),
  input_hash text NOT NULL UNIQUE CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  codes text[] NOT NULL,
  requested_count integer NOT NULL CHECK (requested_count BETWEEN 1 AND 5),
  succeeded_count integer NOT NULL CHECK (succeeded_count = requested_count),
  first_bar_date date NOT NULL,
  last_bar_date date NOT NULL CHECK (last_bar_date >= first_bar_date),
  base_trade_count integer NOT NULL CHECK (base_trade_count >= 0),
  source text NOT NULL DEFAULT 'YAHOO_CHART_1D' CHECK (source = 'YAHOO_CHART_1D'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS horizontal_retest_runs_created_idx
  ON public.horizontal_retest_archive_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.horizontal_retest_archive_trades (
  detector_version text NOT NULL CHECK (detector_version = 'shadow_horizontal_compare_v1'),
  code text NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  breakout_time bigint NOT NULL CHECK (breakout_time > 0),
  retest_time bigint NOT NULL CHECK (retest_time > breakout_time),
  entry_time bigint NOT NULL CHECK (entry_time > retest_time),
  exit_time bigint NOT NULL CHECK (exit_time >= entry_time),
  profit_yen_100 integer NOT NULL,
  return_percent numeric(12,4) NOT NULL CHECK (return_percent BETWEEN -100000 AND 100000),
  volume_eligible boolean NOT NULL,
  technical_eligible boolean NOT NULL,
  first_run_id uuid NOT NULL REFERENCES public.horizontal_retest_archive_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (detector_version, code, breakout_time, retest_time, entry_time),
  CONSTRAINT horizontal_retest_nested_filters CHECK (NOT technical_eligible OR volume_eligible)
);
CREATE INDEX IF NOT EXISTS horizontal_retest_trades_order_idx
  ON public.horizontal_retest_archive_trades (detector_version, exit_time, code);

ALTER TABLE public.horizontal_retest_archive_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizontal_retest_archive_trades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.horizontal_retest_archive_runs, public.horizontal_retest_archive_trades
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.horizontal_retest_archive_runs, public.horizontal_retest_archive_trades
  TO service_role;
-- Append-only first-observation wins for the same code and exact signal dates.
-- ON CONFLICT DO NOTHING means double clicks/overlapping cohorts cannot inflate the event count.
-- Do not grant UPDATE / DELETE / TRUNCATE to application roles.
