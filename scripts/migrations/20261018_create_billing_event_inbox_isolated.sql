-- PROPOSAL ONLY: NEVER APPLY TO PRODUCTION WITHOUT DB REVIEW.
-- Authentication/verification of provider notices must happen in separate trusted code.
BEGIN;
CREATE TABLE IF NOT EXISTS public.signalx_billing_event_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe','google_play')),
  provider_event_id TEXT NOT NULL CHECK (length(btrim(provider_event_id)) BETWEEN 1 AND 255),
  external_subscription_id TEXT NOT NULL CHECK (length(btrim(external_subscription_id)) BETWEEN 1 AND 255),
  provider_event_at TIMESTAMPTZ NOT NULL,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('stripe_signature','google_play_developer_api')),
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending','applied','ignored_stale','rejected','failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT signalx_billing_event_inbox_provider_event_unique UNIQUE(provider,provider_event_id)
);
CREATE INDEX IF NOT EXISTS signalx_billing_event_inbox_pending_idx
  ON public.signalx_billing_event_inbox (received_at)
  WHERE processing_status = 'pending';
ALTER TABLE public.signalx_billing_event_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.signalx_billing_event_inbox
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.signalx_billing_event_inbox TO postgres;
COMMENT ON TABLE public.signalx_billing_event_inbox IS
  'Future verified-event idempotency ledger. No raw payloads, tokens, card data or untrusted client writes.';
COMMIT;
