-- AI POWER is calculated with decimal precision (for example, 99.3).
-- Preserve that precision when saving the daily learning snapshot.
ALTER TABLE public.daily_stock_results
ALTER COLUMN score TYPE numeric
USING score::numeric;

-- Pattern learning stores the same decimal AI POWER value.
ALTER TABLE public.pattern_learning_logs
ALTER COLUMN ai_power TYPE numeric
USING ai_power::numeric;
