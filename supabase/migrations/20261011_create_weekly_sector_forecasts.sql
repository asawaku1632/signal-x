-- Immutable weekly sector predictions, for later out-of-sample comparison.
-- Stored separately from trading / judgement / notification tables.
CREATE TABLE IF NOT EXISTS public.weekly_sector_forecasts (
  target_week_start date PRIMARY KEY,
  target_week_end date NOT NULL,
  source_week_start date NOT NULL,
  source_week_end date NOT NULL,
  as_of_date date,
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  eligible_sector_count integer NOT NULL DEFAULT 0 CHECK (eligible_sector_count >= 0),
  classifier_version text NOT NULL DEFAULT 'representative-v1',
  model_version text NOT NULL DEFAULT 'weekly-sector-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_sector_valid_target CHECK (target_week_end >= target_week_start),
  CONSTRAINT weekly_sector_valid_source CHECK (source_week_end < target_week_start)
);
ALTER TABLE public.weekly_sector_forecasts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.weekly_sector_forecasts FROM anon, authenticated;
COMMENT ON TABLE public.weekly_sector_forecasts IS 'Fixed, read-only-to-users weekly sector forecasts. The historical prediction is never recomputed after publication. No order/trade/notification effects.';
