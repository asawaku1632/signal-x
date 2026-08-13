BEGIN;

-- Shared last-known-good payloads used for stale-while-revalidate display.
CREATE TABLE IF NOT EXISTS public.display_snapshots (
  snapshot_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS display_snapshots_updated_at_idx
ON public.display_snapshots (updated_at DESC);

-- Server-internal cache data must not be exposed through the Supabase Data API.
ALTER TABLE public.display_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.display_snapshots
FROM PUBLIC, anon, authenticated, service_role;

-- SIGNALX connects through the Supabase pooler as the postgres database role.
-- The repository only reads and upserts snapshots; DELETE is not required.
GRANT SELECT, INSERT, UPDATE ON TABLE public.display_snapshots TO postgres;

COMMIT;
