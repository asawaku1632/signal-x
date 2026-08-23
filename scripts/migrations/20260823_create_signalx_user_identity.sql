BEGIN;

CREATE TABLE public.signalx_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email TEXT,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  CONSTRAINT signalx_users_primary_email_check CHECK (
    primary_email IS NULL
    OR (
      primary_email = LOWER(BTRIM(primary_email))
      AND LENGTH(primary_email) BETWEEN 3 AND 320
    )
  )
);

CREATE TABLE public.signalx_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  provider_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT signalx_identities_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.signalx_users (id)
    ON DELETE CASCADE,
  CONSTRAINT signalx_identities_provider_subject_key
    UNIQUE (provider, provider_subject),
  CONSTRAINT signalx_identities_provider_check
    CHECK (provider = LOWER(BTRIM(provider)) AND LENGTH(provider) BETWEEN 1 AND 64),
  CONSTRAINT signalx_identities_provider_subject_check
    CHECK (provider_subject = BTRIM(provider_subject) AND LENGTH(provider_subject) BETWEEN 1 AND 255),
  CONSTRAINT signalx_identities_provider_email_check CHECK (
    provider_email IS NULL
    OR (
      provider_email = LOWER(BTRIM(provider_email))
      AND LENGTH(provider_email) BETWEEN 3 AND 320
    )
  )
);

CREATE INDEX signalx_identities_user_id_idx
  ON public.signalx_identities (user_id);

COMMENT ON TABLE public.signalx_users IS
  'Server-only internal SIGNALX user records. UUIDs are identifiers, not authorization grants.';
COMMENT ON TABLE public.signalx_identities IS
  'Server-verified external identities linked to internal SIGNALX users.';
COMMENT ON COLUMN public.signalx_identities.provider_subject IS
  'Provider-stable subject obtained from a server-side verified OAuth response; never derived from email.';

ALTER TABLE public.signalx_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalx_identities ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.signalx_users
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.signalx_identities
  FROM PUBLIC, anon, authenticated, service_role;

-- SIGNALX server code connects through DATABASE_URL as the postgres role.
-- Phase 1 has no user-deletion flow, so DELETE is intentionally not granted.
GRANT SELECT, INSERT, UPDATE ON TABLE public.signalx_users TO postgres;
GRANT SELECT, INSERT, UPDATE ON TABLE public.signalx_identities TO postgres;

COMMIT;
