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
  activation_notified_at TIMESTAMPTZ,
  result_notification_claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS favorite_ai_monitors_one_active_idx
ON public.favorite_ai_monitors (user_email, code)
WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS favorite_ai_monitors_status_idx
ON public.favorite_ai_monitors (status, triggered_at);

-- LINE recipient binding is intentionally separate from favorites.
-- A monitor may exist before a user has connected LINE.
CREATE TABLE IF NOT EXISTS public.line_user_bindings (
  signalx_user_id UUID PRIMARY KEY REFERENCES public.signalx_users(id) ON DELETE CASCADE,
  user_email TEXT,
  line_user_id TEXT NOT NULL UNIQUE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.line_link_tokens (
  token_hash TEXT PRIMARY KEY,
  signalx_user_id UUID NOT NULL REFERENCES public.signalx_users(id) ON DELETE CASCADE,
  user_email TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS line_link_tokens_expires_idx
ON public.line_link_tokens (expires_at);

CREATE TABLE IF NOT EXISTS public.favorite_ai_watch_states (
  user_email TEXT NOT NULL,
  code TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ARMED'
    CHECK (state IN ('ARMED', 'DISARMED')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, code)
);
