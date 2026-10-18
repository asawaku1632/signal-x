-- CRASH_FORWARD_CAPTURE_V1. Dedicated immutable owner-only research storage.
-- No changes to daily_stock_results, existing notifications, AI scores, or trades.
CREATE TABLE IF NOT EXISTS public.crash_forward_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trade_date date NOT NULL UNIQUE,
  previous_trade_date date NOT NULL,
  index_source text NOT NULL DEFAULT 'YAHOO_NIKKEI_DAILY_CLOSE',
  nikkei_close numeric NOT NULL CHECK (nikkei_close>0),
  nikkei_previous_close numeric NOT NULL CHECK (nikkei_previous_close>0),
  nikkei_day_return numeric NOT NULL,
  baseline_stock_count integer NOT NULL CHECK (baseline_stock_count>=800),
  comparable_stock_count integer NOT NULL CHECK (comparable_stock_count>=800),
  selected_at timestamptz NOT NULL DEFAULT now(),
  captured_version text NOT NULL DEFAULT 'CRASH_FORWARD_CAPTURE_V1',
  sealed boolean NOT NULL DEFAULT true,
  selection_hash text NOT NULL CHECK (length(selection_hash)=64)
);
CREATE TABLE IF NOT EXISTS public.crash_forward_candidates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES public.crash_forward_events(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('RESISTANCE','REBOUND_WATCH')),
  rank integer NOT NULL CHECK (rank BETWEEN 1 AND 20),
  code text NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  name text NOT NULL,
  signal_close numeric NOT NULL CHECK (signal_close>0),
  previous_close numeric NOT NULL CHECK (previous_close>0),
  daily_return numeric NOT NULL,
  excess_return numeric NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id,category,code),
  UNIQUE(event_id,category,rank)
);
CREATE TABLE IF NOT EXISTS public.crash_forward_outcomes (
  candidate_id bigint PRIMARY KEY REFERENCES public.crash_forward_candidates(id) ON DELETE RESTRICT,
  next_trade_date date NOT NULL,
  next_close numeric,
  nikkei_next_return numeric NOT NULL,
  stock_return numeric,
  excess_return numeric,
  beat_nikkei boolean,
  status text NOT NULL CHECK(status IN ('OBSERVED','MISSING_PRICE','REVIEW_PRICE_JUMP')),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status='MISSING_PRICE' OR next_close>0),
  CHECK (status<>'OBSERVED' OR stock_return IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS crash_forward_candidates_event_idx
 ON public.crash_forward_candidates(event_id,category,rank);
CREATE INDEX IF NOT EXISTS crash_forward_events_date_idx
 ON public.crash_forward_events(trade_date DESC);
ALTER TABLE public.crash_forward_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crash_forward_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crash_forward_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crash_forward_events,public.crash_forward_candidates,public.crash_forward_outcomes FROM anon,authenticated;
-- App accesses through DATABASE_URL on the server only. No public policies.
