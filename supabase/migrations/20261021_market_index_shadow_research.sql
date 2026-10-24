-- Research-only index observations; no production scoring/notification dependencies.
-- Do not apply to production until RLS and deployment review is completed.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS public.market_index_shadow_observations (
  session_date_jst date NOT NULL,
  index_key text NOT NULL CHECK (index_key IN ('nikkei','topix')),
  observed_at timestamptz NOT NULL,
  captured_at timestamptz NOT NULL,
  index_value numeric NOT NULL CHECK (index_value > 0),
  source_name text NOT NULL CHECK (length(trim(source_name)) > 0),
  policy_version text NOT NULL DEFAULT 'market-index-shadow-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_date_jst, index_key, observed_at, policy_version),
  CONSTRAINT market_index_shadow_timestamp_order CHECK (observed_at <= captured_at + interval '1 minute'),
  CONSTRAINT market_index_shadow_same_jst_date CHECK (
    (observed_at AT TIME ZONE 'Asia/Tokyo')::date = session_date_jst
  )
);
ALTER TABLE public.market_index_shadow_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_index_shadow_observations FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS market_index_shadow_lookup_idx
  ON public.market_index_shadow_observations (index_key, session_date_jst DESC, observed_at DESC);
COMMIT;
