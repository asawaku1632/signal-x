-- PROPOSAL ONLY. DO NOT APPLY TO PRODUCTION WITHOUT REVIEW.
-- Additive, server-only billing entitlement storage; never stores payment credentials.
BEGIN;
CREATE TABLE IF NOT EXISTS public.signalx_premium_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.signalx_users(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'google_play')),
  external_subscription_id TEXT NOT NULL CHECK (length(btrim(external_subscription_id)) BETWEEN 1 AND 255),
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'grace_period', 'past_due', 'paused', 'canceled', 'expired', 'revoked')),
  valid_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  provider_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT signalx_premium_entitlements_provider_external_unique UNIQUE (provider, external_subscription_id)
);
CREATE INDEX IF NOT EXISTS signalx_premium_entitlements_user_idx
  ON public.signalx_premium_entitlements(user_id);
ALTER TABLE public.signalx_premium_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.signalx_premium_entitlements
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.signalx_premium_entitlements TO postgres;
COMMENT ON TABLE public.signalx_premium_entitlements IS
  'Isolated future billing entitlement storage; do not trust client-written subscription status.';
COMMIT;
