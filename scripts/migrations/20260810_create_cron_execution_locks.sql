-- Prevent concurrent executions of date-scoped cron jobs.
-- Apply this migration before deploying code that acquires these locks.
CREATE TABLE IF NOT EXISTS public.cron_execution_locks (
  lock_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS cron_execution_locks_expires_at_idx
ON public.cron_execution_locks (expires_at);
