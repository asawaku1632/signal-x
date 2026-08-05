-- AI POWER is calculated with decimal precision (for example, 99.3).
-- Preserve that precision when saving the daily learning snapshot.
ALTER TABLE public.daily_stock_results
ALTER COLUMN score TYPE numeric
USING score::numeric;
