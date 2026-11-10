-- J-Quants raw/adjusted closes staged for audit; not yet verified outcomes.
-- No automatic promotion to owner_ranking_verified_closes.
CREATE TABLE IF NOT EXISTS owner_ranking_jquants_daily_staging (
 trade_date DATE NOT NULL,
 code TEXT NOT NULL,
 raw_close NUMERIC NOT NULL CHECK (raw_close > 0),
 adjusted_close NUMERIC NOT NULL CHECK (adjusted_close > 0),
 adjustment_ratio NUMERIC NOT NULL CHECK (adjustment_ratio > 0),
 retrieved_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY (trade_date, code)
);
REVOKE ALL ON owner_ranking_jquants_daily_staging FROM PUBLIC;
