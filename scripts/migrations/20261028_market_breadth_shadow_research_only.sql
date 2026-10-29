-- Research-only proposal. NOT applied to any database.
-- No automated collector or signal/notification integration.
CREATE TABLE IF NOT EXISTS public.market_breadth_shadow_snapshots (
  id BIGSERIAL PRIMARY KEY,
  trade_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL CHECK (length(trim(provider)) > 0),
  license_reference TEXT NOT NULL CHECK (length(trim(license_reference)) > 0),
  nikkei_change_pct NUMERIC NOT NULL,
  topix_change_pct NUMERIC NOT NULL,
  advancers INTEGER NOT NULL CHECK (advancers >= 0),
  decliners INTEGER NOT NULL CHECK (decliners >= 0),
  unchanged INTEGER NOT NULL CHECK (unchanged >= 0),
  classification TEXT NOT NULL CHECK (classification IN ('INDEX_BREADTH_DIVERGENCE','OBSERVED')),
  rule_version TEXT NOT NULL DEFAULT 'market-breadth-shadow-v1'
    CHECK (rule_version = 'market-breadth-shadow-v1'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (advancers + decliners + unchanged > 0),
  CHECK ((observed_at AT TIME ZONE 'Asia/Tokyo')::date = trade_date),
  UNIQUE (trade_date, observed_at, provider, rule_version)
);
CREATE INDEX IF NOT EXISTS market_breadth_shadow_trade_date_idx
  ON public.market_breadth_shadow_snapshots(trade_date DESC);
ALTER TABLE public.market_breadth_shadow_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_breadth_shadow_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.market_breadth_shadow_snapshots_id_seq FROM PUBLIC, anon, authenticated;
-- Only a separately reviewed, server-side service role may write.
-- Historical backfill must preserve original as-of timestamps and licensed provenance.
