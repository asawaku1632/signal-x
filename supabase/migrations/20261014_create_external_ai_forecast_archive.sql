-- Owner-only external forecast archive. Additive & isolated.
-- Apply in signal-x-dev first. No link to AI ranking, learning, orders or alerts.
CREATE TABLE public.external_ai_forecast_archive (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  trade_date date NOT NULL CHECK (trade_date >= DATE '2020-01-01' AND trade_date <= DATE '2100-01-01'),
  provider_name text NOT NULL CHECK (char_length(provider_name) BETWEEN 1 AND 60),
  code text NOT NULL CHECK (code ~ '^([0-9]{4}|[0-9]{3}[A-Z])$'),
  stock_name text NOT NULL CHECK (char_length(stock_name) BETWEEN 1 AND 80),
  buy_limit numeric(11,3) NOT NULL CHECK (buy_limit > 0 AND buy_limit < 100000000),
  original_post_url text CHECK (original_post_url IS NULL OR char_length(original_post_url) <= 1800),
  claimed_published_at timestamptz CHECK (claimed_published_at IS NULL OR claimed_published_at <= recorded_at),
  source_note text CHECK (source_note IS NULL OR char_length(source_note) <= 400),
  CONSTRAINT external_ai_unique_immutable_signal UNIQUE (trade_date, provider_name, code, buy_limit)
);
COMMENT ON TABLE public.external_ai_forecast_archive IS
 'Research only: manually recorded external AI candidate prices. No verified publication time or fill evidence. Never used for AI learning.';
CREATE INDEX external_ai_forecast_archive_date_idx
  ON public.external_ai_forecast_archive (trade_date DESC, id DESC);
ALTER TABLE public.external_ai_forecast_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.external_ai_forecast_archive FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.external_ai_forecast_archive_id_seq FROM PUBLIC, anon, authenticated;
-- Even privileged application SQL cannot change or delete an archived record by mistake.
CREATE FUNCTION public.prevent_external_ai_archive_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'External forecast history is append-only: correction requires a new separately documented entry';
END;
$$;
CREATE TRIGGER external_ai_archive_append_only
BEFORE UPDATE OR DELETE ON public.external_ai_forecast_archive
FOR EACH ROW EXECUTE FUNCTION public.prevent_external_ai_archive_mutation();
