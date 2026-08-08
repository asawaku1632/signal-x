BEGIN;

CREATE TABLE IF NOT EXISTS public.play_review_login_attempts (
  identifier_hash TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.play_review_login_attempts IS
  'Rate-limit state for the Google Play review credentials provider.';

COMMENT ON COLUMN public.play_review_login_attempts.identifier_hash IS
  'HMAC-SHA256 identifier derived from the client IP; raw IP addresses are not stored.';

COMMIT;
