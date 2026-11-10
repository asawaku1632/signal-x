-- Dedicated immutable post-capture outcome inputs; never reuse mutable score tables as prices.
CREATE TABLE IF NOT EXISTS owner_ranking_verified_closes (
 trade_date DATE NOT NULL,
 code TEXT NOT NULL,
 adjusted_close NUMERIC NOT NULL CHECK (adjusted_close > 0),
 provider TEXT NOT NULL CHECK (provider IN ('JQUANTS_ADJUSTED_DAILY')),
 provider_published_at TIMESTAMPTZ NOT NULL,
 verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 adjustment_version TEXT NOT NULL,
 PRIMARY KEY(trade_date, code, provider, adjustment_version)
);
CREATE TABLE IF NOT EXISTS owner_ranking_forward_outcomes (
 capture_id BIGINT NOT NULL REFERENCES owner_ranking_forward_captures(id),
 code TEXT NOT NULL,
 horizon INTEGER NOT NULL CHECK (horizon IN (1,3,5)),
 outcome_date DATE NOT NULL,
 entry_price NUMERIC NOT NULL CHECK (entry_price > 0),
 exit_adjusted_close NUMERIC NOT NULL CHECK (exit_adjusted_close > 0),
 return_pct NUMERIC NOT NULL,
 price_provider TEXT NOT NULL,
 adjustment_version TEXT NOT NULL,
 calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(capture_id, code, horizon)
);
REVOKE ALL ON owner_ranking_verified_closes, owner_ranking_forward_outcomes FROM PUBLIC;
