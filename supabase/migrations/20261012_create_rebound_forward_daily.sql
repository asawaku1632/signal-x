-- Isolated, operator-controlled 100-stock support rebound forward study.
-- No production scoring, notifications, trading or training tables referenced.
CREATE TABLE IF NOT EXISTS public.rebound_forward_control (
  singleton smallint PRIMARY KEY DEFAULT 1 CHECK (singleton=1),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.rebound_forward_control(singleton,enabled)
VALUES(1,false) ON CONFLICT(singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rebound_forward_daily_batches (
  trade_date date NOT NULL,
  batch smallint NOT NULL CHECK(batch BETWEEN 0 AND 1),
  state text NOT NULL DEFAULT 'CLAIMED' CHECK(state IN ('CLAIMED','DONE','PARTIAL','FAILED')),
  requested smallint NOT NULL DEFAULT 50 CHECK(requested=50),
  succeeded smallint NOT NULL DEFAULT 0 CHECK(succeeded BETWEEN 0 AND 50),
  failed smallint NOT NULL DEFAULT 0 CHECK(failed BETWEEN 0 AND 50),
  new_signals integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY(trade_date,batch)
);

CREATE TABLE IF NOT EXISTS public.rebound_forward_stock_checks (
  trade_date date NOT NULL,
  batch smallint NOT NULL CHECK(batch BETWEEN 0 AND 1),
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  state text NOT NULL CHECK(state IN ('DONE','FAILED','STALE')),
  note text,
  latest_bar_date date,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(trade_date,code),
  FOREIGN KEY(trade_date,batch) REFERENCES public.rebound_forward_daily_batches(trade_date,batch)
);
CREATE INDEX IF NOT EXISTS rebound_forward_stock_checks_date_idx
  ON public.rebound_forward_stock_checks(trade_date DESC);

CREATE TABLE IF NOT EXISTS public.rebound_forward_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL CHECK(code ~ '^[0-9]{4}$'),
  signal_time bigint NOT NULL CHECK(signal_time>0),
  signal_day date NOT NULL,
  signal_close numeric NOT NULL CHECK(signal_close>0),
  score_version text NOT NULL,
  score integer CHECK(score BETWEEN 0 AND 100),
  band text CHECK(band IN ('LOW','MID','HIGH')),
  features jsonb,
  state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','OPEN','CLOSED','REVIEW')),
  entry_time bigint,
  entry_price numeric CHECK(entry_price>0),
  exit_time bigint,
  exit_price numeric CHECK(exit_price>0),
  return_percent numeric,
  worst_intratrade_percent numeric,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code,signal_time),
  CHECK((score IS NULL AND band IS NULL) OR (score IS NOT NULL AND band IS NOT NULL)),
  CHECK((state!='CLOSED') OR
    (entry_time IS NOT NULL AND entry_price IS NOT NULL AND exit_time IS NOT NULL
     AND exit_price IS NOT NULL AND return_percent IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS rebound_forward_signals_status_idx
  ON public.rebound_forward_signals(code,state,signal_time);

-- The app accesses these research tables only through server-side DATABASE_URL.
REVOKE ALL ON public.rebound_forward_control FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.rebound_forward_daily_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.rebound_forward_stock_checks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.rebound_forward_signals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.rebound_forward_signals_id_seq FROM PUBLIC, anon, authenticated;
