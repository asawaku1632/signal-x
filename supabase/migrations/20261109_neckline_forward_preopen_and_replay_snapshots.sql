-- SIGNALX private research only. No alerts, AI scoring, order hooks, or public API.
-- Separate immutable pre-open cohort vs historical (explicitly labeled) replay.
CREATE TABLE IF NOT EXISTS public.neckline_replay_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version text NOT NULL,
  requested_codes text[] NOT NULL,
  cohort jsonb NOT NULL,
  cohort_sha256 text NOT NULL CHECK (cohort_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(cohort) = 'array'),
  CHECK (array_length(requested_codes, 1) BETWEEN 1 AND 15)
);

CREATE TABLE IF NOT EXISTS public.neckline_forward_runs (
  run_date date NOT NULL,
  batch smallint NOT NULL CHECK (batch BETWEEN 0 AND 2),
  signal_date date NOT NULL,
  policy_version text NOT NULL,
  codes text[] NOT NULL,
  status text NOT NULL DEFAULT 'CLAIMED'
    CHECK (status IN ('CLAIMED','COMPLETE','PARTIAL','FAILED')),
  results jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(results) = 'array'),
  note text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY (run_date, batch)
);

CREATE TABLE IF NOT EXISTS public.neckline_forward_candidates (
  policy_version text NOT NULL,
  code text NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  signal_date date NOT NULL,
  first_seen_time bigint NOT NULL,
  observed_preopen_date date NOT NULL,
  signal_close numeric NOT NULL CHECK (signal_close > 0),
  low1 numeric NOT NULL CHECK (low1 > 0),
  low2 numeric NOT NULL CHECK (low2 > 0),
  neckline numeric NOT NULL CHECK (neckline > 0),
  first_bottom_time bigint NOT NULL,
  second_bottom_time bigint NOT NULL,
  asof_features jsonb NOT NULL,
  input_bars jsonb NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_version, code, signal_date),
  CHECK (signal_date < observed_preopen_date),
  CHECK (jsonb_typeof(asof_features) = 'object'),
  CHECK (jsonb_typeof(input_bars) = 'array')
);

CREATE TABLE IF NOT EXISTS public.neckline_forward_outcomes (
  policy_version text NOT NULL,
  code text NOT NULL,
  signal_date date NOT NULL,
  horizon smallint NOT NULL CHECK (horizon IN (3,5)),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETE')),
  entry_date date,
  exit_date date,
  entry_open numeric,
  exit_close numeric,
  return_percent numeric,
  worst_adverse_percent numeric,
  evaluation_source_sha256 text,
  completed_at timestamptz,
  PRIMARY KEY (policy_version,code,signal_date,horizon),
  FOREIGN KEY (policy_version,code,signal_date)
    REFERENCES public.neckline_forward_candidates (policy_version,code,signal_date),
  CHECK ((status='PENDING' AND completed_at IS NULL AND return_percent IS NULL)
    OR (status='COMPLETE' AND completed_at IS NOT NULL AND entry_open>0 AND exit_close>0
      AND return_percent IS NOT NULL AND worst_adverse_percent IS NOT NULL
      AND evaluation_source_sha256 ~ '^[0-9a-f]{64}$'))
);
CREATE INDEX IF NOT EXISTS neckline_forward_pending_code_idx
  ON public.neckline_forward_outcomes (code, status) WHERE status = 'PENDING';

-- No client/browser access to archived research records.
ALTER TABLE public.neckline_replay_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neckline_forward_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neckline_forward_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neckline_forward_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.neckline_replay_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.neckline_forward_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.neckline_forward_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.neckline_forward_outcomes FROM PUBLIC, anon, authenticated;

-- Stored candidate snapshots and manual replay snapshots may NEVER be edited
-- or deleted, even by an accidental future privileged query.
CREATE OR REPLACE FUNCTION public.neckline_prevent_frozen_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'NECKLINE_FROZEN_RECORD_IMMUTABLE';
END;
$$;
DROP TRIGGER IF EXISTS neckline_frozen_candidates_guard ON public.neckline_forward_candidates;
CREATE TRIGGER neckline_frozen_candidates_guard
  BEFORE UPDATE OR DELETE ON public.neckline_forward_candidates
  FOR EACH ROW EXECUTE FUNCTION public.neckline_prevent_frozen_changes();
DROP TRIGGER IF EXISTS neckline_replay_snapshots_guard ON public.neckline_replay_snapshots;
CREATE TRIGGER neckline_replay_snapshots_guard
  BEFORE UPDATE OR DELETE ON public.neckline_replay_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.neckline_prevent_frozen_changes();

-- A pending outcome may transition to COMPLETE once; nothing else may change.
CREATE OR REPLACE FUNCTION public.neckline_guard_outcome_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'NECKLINE_OUTCOME_DELETE_FORBIDDEN';
  END IF;
  IF OLD.status <> 'PENDING' OR NEW.status <> 'COMPLETE'
    OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
    OR NEW.code IS DISTINCT FROM OLD.code
    OR NEW.signal_date IS DISTINCT FROM OLD.signal_date
    OR NEW.horizon IS DISTINCT FROM OLD.horizon
    OR NEW.entry_date IS NULL OR NEW.exit_date IS NULL
    OR NEW.completed_at IS NULL THEN
    RAISE EXCEPTION 'NECKLINE_OUTCOME_INVALID_TRANSITION';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS neckline_outcomes_guard ON public.neckline_forward_outcomes;
CREATE TRIGGER neckline_outcomes_guard
  BEFORE UPDATE OR DELETE ON public.neckline_forward_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.neckline_guard_outcome_transition();

REVOKE ALL ON FUNCTION public.neckline_prevent_frozen_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.neckline_guard_outcome_transition() FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.neckline_forward_candidates IS
  'Immutable pre-open frozen real candidates only; never backfilled from later observations. No trading or notifications.';
COMMENT ON TABLE public.neckline_replay_snapshots IS
  'Immutable owner-triggered historical input snapshot. NOT a pre-live captured signal.';
