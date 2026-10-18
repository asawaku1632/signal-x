-- ISOLATED PROPOSAL ONLY: do not apply to production.
-- Never store raw checkout tickets, OAuth credentials, integrity proofs or purchase tokens.
BEGIN;
CREATE TABLE IF NOT EXISTS public.signalx_play_checkout_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_digest CHAR(64) NOT NULL UNIQUE CHECK (ticket_digest ~ '^[0-9a-f]{64}$'),
  user_id UUID NOT NULL REFERENCES public.signalx_users(id),
  package_name TEXT NOT NULL CHECK (package_name='com.signalx.app'),
  product_id TEXT NOT NULL CHECK (length(btrim(product_id)) BETWEEN 1 AND 255),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  CONSTRAINT signalx_play_ticket_ttl CHECK (expires_at>issued_at AND expires_at<=issued_at+INTERVAL '180 seconds'),
  CONSTRAINT signalx_play_ticket_consumed_after_issuance CHECK (consumed_at IS NULL OR consumed_at>=issued_at)
);
CREATE INDEX IF NOT EXISTS signalx_play_checkout_tickets_expiry_idx
  ON public.signalx_play_checkout_tickets (expires_at);
ALTER TABLE public.signalx_play_checkout_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.signalx_play_checkout_tickets
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.signalx_play_checkout_tickets TO postgres;
COMMENT ON TABLE public.signalx_play_checkout_tickets IS
  'Research-only single-use 120-second TWA checkout handoff; server HMAC only; no client access.';
COMMIT;
