CREATE TABLE IF NOT EXISTS public.ema_forward_shadow_state (
 code text PRIMARY KEY CHECK (code ~ '^[0-9]{4}$'),
 last_bar_time bigint, halted boolean NOT NULL DEFAULT false, halt_reason text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ema_forward_shadow_trades (
 id bigserial PRIMARY KEY,
 code text NOT NULL CHECK (code ~ '^[0-9]{4}$'),
 strategy text NOT NULL CHECK (strategy IN ('TAKE','TIME')),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','OPEN','CLOSED','HALTED')),
 signal_time bigint NOT NULL, signal_close numeric NOT NULL CHECK (signal_close > 0),
 observed_at timestamptz NOT NULL DEFAULT now(),
 entry_time bigint,entry_price numeric,exit_queued_reason text CHECK(exit_queued_reason IS NULL OR exit_queued_reason IN ('EMA','TIME')),
 exit_queued_time bigint,exit_time bigint,exit_price numeric,exit_reason text CHECK(exit_reason IS NULL OR exit_reason IN ('EMA','TAKE','TIME')),
 gross_pnl_yen numeric,friction_yen numeric,net_pnl_yen numeric,return_percent numeric,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ema_forward_signal_unique UNIQUE(code,strategy,signal_time)
);
CREATE UNIQUE INDEX IF NOT EXISTS ema_forward_one_active_trade ON public.ema_forward_shadow_trades(code,strategy) WHERE status IN ('PENDING','OPEN');
CREATE INDEX IF NOT EXISTS ema_forward_recent ON public.ema_forward_shadow_trades(observed_at DESC);
ALTER TABLE public.ema_forward_shadow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ema_forward_shadow_trades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ema_forward_shadow_state FROM anon,authenticated;
REVOKE ALL ON public.ema_forward_shadow_trades FROM anon,authenticated;
REVOKE ALL ON SEQUENCE public.ema_forward_shadow_trades_id_seq FROM anon,authenticated;
