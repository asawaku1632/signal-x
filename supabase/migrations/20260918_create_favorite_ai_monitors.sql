CREATE TABLE IF NOT EXISTS public.favorite_ai_monitors (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entry_price DOUBLE PRECISION NOT NULL,
  ai_power INTEGER NOT NULL,
  take_profit DOUBLE PRECISION NOT NULL,
  stop_loss DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'WIN', 'LOSE', 'CANCELLED')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS favorite_ai_monitors_one_active_idx
ON public.favorite_ai_monitors (user_email, code)
WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS favorite_ai_monitors_status_idx
ON public.favorite_ai_monitors (status, triggered_at);
