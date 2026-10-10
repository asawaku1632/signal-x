-- Shadow-only weekly outcome grades calculated from independent, dated Yahoo daily close bars.
-- Forecast data is immutable; failed/partial evaluations can be safely retried.
CREATE TABLE IF NOT EXISTS public.weekly_sector_outcome_audits (
  target_week_start date PRIMARY KEY REFERENCES public.weekly_sector_forecasts(target_week_start),
  baseline_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('COMPLETE','INCOMPLETE')),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  price_source text NOT NULL DEFAULT 'YAHOO_CHART_1D' CHECK (price_source = 'YAHOO_CHART_1D'),
  methodology_version text NOT NULL DEFAULT 'close_to_close_equal_weight_v1',
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > baseline_date)
);
CREATE INDEX IF NOT EXISTS weekly_sector_outcome_audits_status_idx
  ON public.weekly_sector_outcome_audits(status,target_week_start DESC);
ALTER TABLE public.weekly_sector_outcome_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_sector_outcome_audits FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.weekly_sector_outcome_audits IS
  'Research-only independent week-over-week Yahoo daily closes, frozen prediction constituents, no trading-model or price overwrites. Partial outcomes may be retried.';
