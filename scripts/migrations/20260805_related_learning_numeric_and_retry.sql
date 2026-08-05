-- AI POWER keeps one or more decimal places throughout related learning.
ALTER TABLE public.experience_learning_logs
ALTER COLUMN ai_power TYPE numeric
USING ai_power::numeric;

-- Store the logical trade date so pattern snapshots can be replaced safely.
ALTER TABLE public.pattern_learning_logs
ADD COLUMN IF NOT EXISTS trade_date date;

UPDATE public.pattern_learning_logs
SET trade_date = (created_at AT TIME ZONE 'Asia/Tokyo')::date
WHERE trade_date IS NULL;

ALTER TABLE public.pattern_learning_logs
ALTER COLUMN trade_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Tokyo')::date),
ALTER COLUMN trade_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS pattern_learning_logs_trade_date_idx
ON public.pattern_learning_logs (trade_date);
