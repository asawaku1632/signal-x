ALTER TABLE public.favorite_ai_monitors
  ADD COLUMN IF NOT EXISTS result_price DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS result_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS favorite_ai_monitors_pending_result_notification_idx
ON public.favorite_ai_monitors (completed_at)
WHERE status IN ('WIN', 'LOSE')
  AND result_price IS NOT NULL
  AND result_notified_at IS NULL;
