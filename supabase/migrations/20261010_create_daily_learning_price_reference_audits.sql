-- Optional research-only price shadow; never mutates daily_stock_results or trading decisions.
-- Keeps the original AI-decision price and the later Yahoo 1D reference side by side.
-- One immutable observation per JST research day / security / source / trade date.
CREATE TABLE IF NOT EXISTS public.daily_learning_price_reference_audits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  daily_result_id TEXT NOT NULL REFERENCES public.daily_stock_results(id),
  trade_date DATE NOT NULL,
  code TEXT NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  name TEXT NOT NULL,
  baseline_price NUMERIC(20,4) NOT NULL CHECK (baseline_price > 0),
  baseline_saved_at TIMESTAMP WITHOUT TIME ZONE,
  reference_price NUMERIC(20,4) NOT NULL CHECK (reference_price > 0),
  reference_source TEXT NOT NULL CHECK (reference_source = 'YAHOO_CHART_1D'),
  reference_bar_at TIMESTAMPTZ NOT NULL,
  observation_date_jst DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  difference_yen NUMERIC(20,4) NOT NULL,
  comparison_status TEXT NOT NULL CHECK (comparison_status IN ('MATCH','MISMATCH')),
  CONSTRAINT daily_learning_price_reference_observed_later
    CHECK (observation_date_jst > trade_date),
  CONSTRAINT daily_learning_price_reference_unique
    UNIQUE (trade_date, code, reference_source, observation_date_jst)
);
CREATE INDEX IF NOT EXISTS daily_learning_price_reference_date_idx
  ON public.daily_learning_price_reference_audits (trade_date DESC, code);
ALTER TABLE public.daily_learning_price_reference_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.daily_learning_price_reference_audits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.daily_learning_price_reference_audits TO postgres, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.daily_learning_price_reference_audits_id_seq TO postgres, service_role;
