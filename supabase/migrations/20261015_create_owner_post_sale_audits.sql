-- Owner-only research for manually entered REAL executed sale records.
-- This archive is independent of paper_trades and AI production scoring.
CREATE TABLE IF NOT EXISTS public.owner_post_sale_audits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_email TEXT NOT NULL,
  code TEXT NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  name TEXT NOT NULL,
  sale_date DATE NOT NULL,
  buy_price NUMERIC(16,4) NOT NULL CHECK (buy_price > 0),
  sale_price NUMERIC(16,4) NOT NULL CHECK (sale_price > 0),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  cohort TEXT NOT NULL CHECK (cohort IN ('FORWARD', 'LATE_REGISTERED')),
  registration_source TEXT NOT NULL DEFAULT 'OWNER_MANUAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome_1d_date DATE,
  outcome_1d_price NUMERIC(16,4) CHECK (outcome_1d_price > 0),
  outcome_3d_date DATE,
  outcome_3d_price NUMERIC(16,4) CHECK (outcome_3d_price > 0),
  outcome_5d_date DATE,
  outcome_5d_price NUMERIC(16,4) CHECK (outcome_5d_price > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_post_sale_pair_1 CHECK ((outcome_1d_date IS NULL) = (outcome_1d_price IS NULL)),
  CONSTRAINT owner_post_sale_pair_3 CHECK ((outcome_3d_date IS NULL) = (outcome_3d_price IS NULL)),
  CONSTRAINT owner_post_sale_pair_5 CHECK ((outcome_5d_date IS NULL) = (outcome_5d_price IS NULL)),
  CONSTRAINT owner_post_sale_unique_trade UNIQUE (owner_email, sale_date, code, buy_price, sale_price, quantity)
);
CREATE INDEX IF NOT EXISTS owner_post_sale_pending_idx ON public.owner_post_sale_audits (sale_date DESC)
  WHERE outcome_1d_price IS NULL OR outcome_3d_price IS NULL OR outcome_5d_price IS NULL;
ALTER TABLE public.owner_post_sale_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_post_sale_audits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.owner_post_sale_audits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.owner_post_sale_audits_id_seq TO service_role;
