-- PROPOSAL ONLY: do not run against production.
-- Store keyed HMAC fingerprint, NEVER raw purchase tokens or OAuth secrets.
BEGIN;
CREATE TABLE IF NOT EXISTS public.signalx_play_purchase_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.signalx_users(id),
  purchase_token_fingerprint CHAR(64) NOT NULL
    CHECK (purchase_token_fingerprint ~ '^[0-9a-f]{64}$'),
  package_name TEXT NOT NULL CHECK (length(btrim(package_name)) BETWEEN 3 AND 255),
  product_id TEXT NOT NULL CHECK (length(btrim(product_id)) BETWEEN 1 AND 255),
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  CONSTRAINT signalx_play_purchase_bindings_fingerprint_unique UNIQUE (purchase_token_fingerprint)
);
-- Immutable purchase ownership: do not allow account transfers or token/product re-keying.
CREATE OR REPLACE FUNCTION public.signalx_prevent_play_binding_reassignment()
RETURNS TRIGGER LANGUAGE plpgsql AS $
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.purchase_token_fingerprint IS DISTINCT FROM OLD.purchase_token_fingerprint
     OR NEW.package_name IS DISTINCT FROM OLD.package_name
     OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    RAISE EXCEPTION 'Play binding identity fields are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$;
CREATE TRIGGER signalx_play_binding_immutable
  BEFORE UPDATE ON public.signalx_play_purchase_bindings
  FOR EACH ROW EXECUTE FUNCTION public.signalx_prevent_play_binding_reassignment();
CREATE INDEX IF NOT EXISTS signalx_play_purchase_bindings_user_idx
  ON public.signalx_play_purchase_bindings (user_id);
ALTER TABLE public.signalx_play_purchase_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.signalx_play_purchase_bindings
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.signalx_play_purchase_bindings TO postgres;
COMMENT ON TABLE public.signalx_play_purchase_bindings IS
  'Server-only original ownership of verified Play purchase token HMAC fingerprint. No client token or raw token storage.';
COMMIT;
