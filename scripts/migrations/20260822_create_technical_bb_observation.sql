-- Phase 4B: independent Bollinger Observation storage only.
-- Do not connect these tables to existing BB, AI, ranking, notification, or Cron flows.
CREATE TABLE public.technical_bb_observation_snapshots (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL CHECK (code <> ''),
  observation_date DATE NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('1D', '1W')),
  close NUMERIC NOT NULL CHECK (close > 0),
  bb_period SMALLINT NOT NULL CHECK (bb_period = 20),
  bb_middle NUMERIC NOT NULL,
  standard_deviation NUMERIC NOT NULL CHECK (standard_deviation > 0),
  bb_upper_1 NUMERIC NOT NULL,
  bb_upper_2 NUMERIC NOT NULL,
  bb_upper_3 NUMERIC NOT NULL,
  bb_lower_1 NUMERIC NOT NULL,
  bb_lower_2 NUMERIC NOT NULL,
  bb_lower_3 NUMERIC NOT NULL,
  bb_sigma_position NUMERIC NOT NULL,
  detector_version TEXT NOT NULL CHECK (detector_version <> ''),
  provider TEXT NOT NULL CHECK (provider <> ''),
  provider_timestamp TIMESTAMPTZ,
  bar_start_at TIMESTAMPTZ NOT NULL,
  bar_end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL CHECK (timezone <> ''),
  rsi14 NUMERIC,
  macd NUMERIC,
  macd_signal NUMERIC,
  macd_histogram NUMERIC,
  macd_cross TEXT CHECK (
    macd_cross IS NULL OR macd_cross IN ('GOLDEN_CROSS', 'DEAD_CROSS')
  ),
  ema20 NUMERIC,
  ema75 NUMERIC,
  ema200 NUMERIC,
  atr14 NUMERIC,
  volume_ratio_20 NUMERIC,
  rsi_availability TEXT NOT NULL CHECK (
    rsi_availability IN ('AVAILABLE', 'UNAVAILABLE', 'INSUFFICIENT_HISTORY', 'INVALID')
  ),
  macd_availability TEXT NOT NULL CHECK (
    macd_availability IN ('AVAILABLE', 'UNAVAILABLE', 'INSUFFICIENT_HISTORY', 'INVALID')
  ),
  ema_availability TEXT NOT NULL CHECK (
    ema_availability IN ('AVAILABLE', 'UNAVAILABLE', 'INSUFFICIENT_HISTORY', 'INVALID')
  ),
  atr_availability TEXT NOT NULL CHECK (
    atr_availability IN ('AVAILABLE', 'UNAVAILABLE', 'INSUFFICIENT_HISTORY', 'INVALID')
  ),
  volume_ratio_availability TEXT NOT NULL CHECK (
    volume_ratio_availability IN ('AVAILABLE', 'UNAVAILABLE', 'INSUFFICIENT_HISTORY', 'INVALID')
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (bar_start_at < bar_end_at),
  CHECK (rsi_availability <> 'AVAILABLE' OR rsi14 IS NOT NULL),
  CHECK (macd_availability <> 'AVAILABLE' OR
    (macd IS NOT NULL AND macd_signal IS NOT NULL AND macd_histogram IS NOT NULL)),
  CHECK (ema_availability <> 'AVAILABLE' OR
    (ema20 IS NOT NULL AND ema75 IS NOT NULL AND ema200 IS NOT NULL)),
  CHECK (atr_availability <> 'AVAILABLE' OR atr14 IS NOT NULL),
  CHECK (volume_ratio_availability <> 'AVAILABLE' OR volume_ratio_20 IS NOT NULL),
  CONSTRAINT technical_bb_observation_snapshots_idempotency_key
    UNIQUE (code, timeframe, bar_end_at, detector_version)
);

CREATE INDEX technical_bb_observation_snapshots_analysis_idx
ON public.technical_bb_observation_snapshots (
  timeframe, detector_version, observation_date DESC
);

CREATE INDEX technical_bb_observation_snapshots_code_idx
ON public.technical_bb_observation_snapshots (
  code, timeframe, observation_date DESC
);

CREATE TABLE public.technical_bb_observation_events (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id BIGINT NOT NULL
    REFERENCES public.technical_bb_observation_snapshots(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('LOWER', 'UPPER')),
  sigma_level SMALLINT NOT NULL CHECK (sigma_level IN (2, 3)),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('TOUCH', 'CROSS', 'CONTINUATION', 'RETURN_INSIDE')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT technical_bb_observation_events_idempotency_key
    UNIQUE (snapshot_id, side, sigma_level, event_type)
);

CREATE INDEX technical_bb_observation_events_analysis_idx
ON public.technical_bb_observation_events (
  side, sigma_level, event_type, snapshot_id
);

CREATE TABLE public.technical_bb_observation_results (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL
    REFERENCES public.technical_bb_observation_events(id) ON DELETE CASCADE,
  horizon SMALLINT NOT NULL CHECK (horizon IN (1, 3, 5)),
  horizon_unit TEXT NOT NULL CHECK (horizon_unit = 'TRADING_DAY'),
  entry_price NUMERIC NOT NULL CHECK (entry_price > 0),
  future_close NUMERIC NOT NULL CHECK (future_close > 0),
  return_percent NUMERIC NOT NULL,
  max_rise_percent NUMERIC NOT NULL,
  max_drawdown_percent NUMERIC NOT NULL,
  max_rise_trade_date DATE NOT NULL,
  max_drawdown_trade_date DATE NOT NULL,
  evaluated_trade_date DATE NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  window_candle_count SMALLINT NOT NULL CHECK (window_candle_count > 0),
  result_quality TEXT NOT NULL CHECK (result_quality <> ''),
  result_version TEXT NOT NULL CHECK (result_version <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT technical_bb_observation_results_idempotency_key
    UNIQUE (event_id, horizon, horizon_unit, result_version)
);

-- The results unique index already has (event_id, horizon) as its leading columns.
ALTER TABLE public.technical_bb_observation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_bb_observation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_bb_observation_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.technical_bb_observation_snapshots,
  public.technical_bb_observation_events,
  public.technical_bb_observation_results
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE
  public.technical_bb_observation_snapshots_id_seq,
  public.technical_bb_observation_events_id_seq,
  public.technical_bb_observation_results_id_seq
FROM PUBLIC, anon, authenticated, service_role;
