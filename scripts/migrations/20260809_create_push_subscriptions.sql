BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT push_subscriptions_user_email_normalized_check
    CHECK (user_email = LOWER(BTRIM(user_email)) AND LENGTH(user_email) BETWEEN 3 AND 320),
  CONSTRAINT push_subscriptions_endpoint_not_empty_check
    CHECK (LENGTH(BTRIM(endpoint)) BETWEEN 1 AND 4096),
  CONSTRAINT push_subscriptions_p256dh_not_empty_check
    CHECK (LENGTH(BTRIM(p256dh)) BETWEEN 1 AND 512),
  CONSTRAINT push_subscriptions_auth_not_empty_check
    CHECK (LENGTH(BTRIM(auth)) BETWEEN 1 AND 512),
  CONSTRAINT push_subscriptions_failure_count_check CHECK (failure_count >= 0)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_email_idx
  ON public.push_subscriptions (user_email);

CREATE INDEX IF NOT EXISTS push_subscriptions_active_user_idx
  ON public.push_subscriptions (user_email, updated_at DESC)
  WHERE enabled = TRUE AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.push_test_rate_limits (
  user_email TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 1,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_test_rate_limits_user_email_normalized_check
    CHECK (user_email = LOWER(BTRIM(user_email)) AND LENGTH(user_email) BETWEEN 3 AND 320),
  CONSTRAINT push_test_rate_limits_request_count_check CHECK (request_count >= 0)
);

-- These tables contain server-only push credentials and rate-limit state.
-- Keep them inaccessible through Supabase's public Data API roles.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_test_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_subscriptions
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.push_test_rate_limits
  FROM PUBLIC, anon, authenticated, service_role;

-- SIGNALX connects through DATABASE_URL as the Supabase postgres role.
-- No DELETE privilege is required by the Phase 1 repository.
GRANT SELECT, INSERT, UPDATE ON TABLE public.push_subscriptions TO postgres;
GRANT SELECT, INSERT, UPDATE ON TABLE public.push_test_rate_limits TO postgres;

COMMIT;
