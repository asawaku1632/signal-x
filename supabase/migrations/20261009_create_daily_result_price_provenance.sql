-- Per-result proof of the price used in future daily WIN/LOSE/HOLD checks.
-- Intentionally no retroactive population: historical origin is unknown.
CREATE TABLE IF NOT EXISTS public.daily_result_price_provenance (
  daily_result_id TEXT PRIMARY KEY REFERENCES public.daily_stock_results(id) ON DELETE CASCADE,
  source_row_id TEXT NOT NULL REFERENCES public.daily_stock_results(id),
  trade_date DATE NOT NULL,
  code TEXT NOT NULL,
  source_trade_date DATE NOT NULL,
  source_table TEXT NOT NULL CHECK (source_table = 'daily_stock_results'),
  source_price DOUBLE PRECISION NOT NULL CHECK (source_price > 0),
  source_snapshot_created_at TIMESTAMP WITHOUT TIME ZONE,
  judged_result TEXT NOT NULL CHECK (judged_result IN ('WIN','LOSE','HOLD')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provenance_forward_date CHECK (source_trade_date > trade_date)
);
CREATE INDEX IF NOT EXISTS daily_result_price_provenance_trade_date_idx
  ON public.daily_result_price_provenance (trade_date DESC);
ALTER TABLE public.daily_result_price_provenance ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daily_result_price_provenance FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.daily_result_price_provenance TO postgres, service_role;
