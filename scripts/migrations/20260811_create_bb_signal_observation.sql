-- Phase 4: Bollinger signal observation only. No scoring or learning updates.
CREATE TABLE public.bb_signal_events (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  signal_date DATE NOT NULL,
  entry_price NUMERIC NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('LOWER_REBOUND', 'UPPER_OVERHEAT')),
  status TEXT NOT NULL CHECK (status IN ('NEAR', 'TOUCHED', 'BREACHED', 'CONFIRMED')),
  upper_regime TEXT NOT NULL DEFAULT 'NONE'
    CHECK (upper_regime IN ('NONE', 'UPPER_TREND', 'UPPER_WATCH', 'UPPER_REVERSAL')),
  expectation SMALLINT NOT NULL CHECK (expectation BETWEEN 0 AND 100),
  band_walk_risk TEXT NOT NULL CHECK (band_walk_risk IN ('LOW', 'MEDIUM', 'HIGH')),
  bb_bonus SMALLINT NOT NULL CHECK (bb_bonus BETWEEN -3 AND 3),
  bb_bonus_reason TEXT NOT NULL DEFAULT '',
  bb_bonus_enabled BOOLEAN NOT NULL,
  upper_band NUMERIC NOT NULL,
  middle_band NUMERIC NOT NULL,
  lower_band NUMERIC NOT NULL,
  distance_percent NUMERIC NOT NULL,
  band_width_percent NUMERIC NOT NULL,
  raw_ai_power_before_bb NUMERIC NOT NULL,
  raw_ai_power_after_bb NUMERIC NOT NULL,
  display_ai_power_before_bb NUMERIC NOT NULL,
  display_ai_power_after_bb NUMERIC NOT NULL,
  confirmations JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bb_signal_events_idempotency_key
    UNIQUE (code, signal_date, side, status, upper_regime)
);

CREATE INDEX bb_signal_events_signal_date_idx
ON public.bb_signal_events (signal_date DESC);

CREATE INDEX bb_signal_events_group_idx
ON public.bb_signal_events (side, status, upper_regime, bb_bonus);

CREATE TABLE public.bb_signal_states (
  code TEXT PRIMARY KEY,
  side TEXT,
  status TEXT,
  upper_regime TEXT NOT NULL DEFAULT 'NONE',
  active BOOLEAN NOT NULL DEFAULT FALSE,
  entered_trade_date DATE,
  last_seen_trade_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.bb_signal_event_results (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.bb_signal_events(id) ON DELETE CASCADE,
  horizon SMALLINT NOT NULL CHECK (horizon IN (1, 5, 10, 20)),
  future_price NUMERIC NOT NULL,
  return_percent NUMERIC NOT NULL,
  evaluated_trade_date DATE NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bb_signal_event_results_idempotency_key UNIQUE (event_id, horizon)
);

CREATE INDEX bb_signal_event_results_horizon_idx
ON public.bb_signal_event_results (horizon, evaluated_trade_date DESC);

-- These are server-only observation tables. Do not rely on environment-specific
-- Supabase event triggers to enable RLS or reduce default privileges.
ALTER TABLE public.bb_signal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_signal_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_signal_event_results ENABLE ROW LEVEL SECURITY;

-- SIGNALX currently writes through the postgres-owned DATABASE_URL connection.
-- Keep API-facing roles (including service_role until a dedicated migration
-- explicitly enables that future path) from accessing observation data.
REVOKE ALL PRIVILEGES ON TABLE
  public.bb_signal_events,
  public.bb_signal_states,
  public.bb_signal_event_results
FROM PUBLIC, anon, authenticated, service_role;

-- BIGSERIAL creates these two sequences. Revoke them explicitly so table
-- restrictions cannot be bypassed through sequence access.
REVOKE ALL PRIVILEGES ON SEQUENCE
  public.bb_signal_events_id_seq,
  public.bb_signal_event_results_id_seq
FROM PUBLIC, anon, authenticated, service_role;
