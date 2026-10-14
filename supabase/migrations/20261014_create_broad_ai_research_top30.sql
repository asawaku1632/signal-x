-- Research-only additive archive. At most 7 lightweight rows per JPX day;
-- each row holds up to 30 frozen, validated observations as JSONB.
-- Completely separate from 5-code entry-price study and 5-code fixed-cohort.
CREATE TABLE IF NOT EXISTS public.broad_ai_research_snapshots (
  trade_date date NOT NULL,
  time_slot text NOT NULL CHECK (time_slot IN ('09:15','09:30','10:30','12:40','13:00','14:30','15:15')),
  prior_date date NOT NULL CHECK (prior_date < trade_date),
  policy_version text NOT NULL,
  expected_count integer NOT NULL CHECK (expected_count BETWEEN 0 AND 30),
  observed_count integer NOT NULL CHECK (observed_count BETWEEN 0 AND 30),
  observations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(observations)='array'),
  missing jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(missing)='array'),
  scan_snapshot_at timestamptz NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trade_date,time_slot),
  CHECK (observed_count <= expected_count)
);
COMMENT ON TABLE public.broad_ai_research_snapshots IS
'Research-only 30 frozen prior-day candidates tracked at seven cached market-scan times. No price provider calls, trade/AI changes or retroactive reconstruction.';
