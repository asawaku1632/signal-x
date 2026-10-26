-- Optional metadata for owner-entered real executions.
-- Existing records remain valid; no production data is changed by this file alone.
ALTER TABLE public.owner_post_sale_audits
  ADD COLUMN IF NOT EXISTS executed_at_jst TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS limit_price NUMERIC(16,4),
  ADD COLUMN IF NOT EXISTS sale_reason TEXT,
  ADD COLUMN IF NOT EXISTS unable_to_monitor BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.owner_post_sale_audits
  DROP CONSTRAINT IF EXISTS owner_post_sale_limit_price_valid;
ALTER TABLE public.owner_post_sale_audits
  ADD CONSTRAINT owner_post_sale_limit_price_valid
  CHECK (limit_price IS NULL OR limit_price > 0);

ALTER TABLE public.owner_post_sale_audits
  DROP CONSTRAINT IF EXISTS owner_post_sale_reason_length_valid;
ALTER TABLE public.owner_post_sale_audits
  ADD CONSTRAINT owner_post_sale_reason_length_valid
  CHECK (sale_reason IS NULL OR char_length(sale_reason) <= 500);

-- No new roles, grants, or policies: preserve existing owner-only API and RLS.
