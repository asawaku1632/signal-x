CREATE TABLE IF NOT EXISTS public.user_favorites (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, code)
);

CREATE INDEX IF NOT EXISTS user_favorites_email_idx
ON public.user_favorites (user_email);

CREATE INDEX IF NOT EXISTS user_favorites_code_idx
ON public.user_favorites (code);
