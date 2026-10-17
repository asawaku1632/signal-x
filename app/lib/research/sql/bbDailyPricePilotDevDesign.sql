-- SIGNALX isolated daily-price pilot / DESIGN ONLY / NOT APPLIED
-- Intended target: signal-x-dev (never production).
-- No cron, triggers, external APIs, LINE, or existing-table changes.
-- Apply only after explicit review of dev project and schema privileges.
BEGIN;
CREATE SCHEMA IF NOT EXISTS bb_daily_price_pilot;
REVOKE ALL ON SCHEMA bb_daily_price_pilot FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS bb_daily_price_pilot.daily_closes (
  code text NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  trade_date date NOT NULL,
  close_unadjusted numeric(20,6) NOT NULL CHECK (close_unadjusted > 0),
  provider text NOT NULL DEFAULT 'YAHOO_CHART_UNADJUSTED'
    CHECK (provider = 'YAHOO_CHART_UNADJUSTED'),
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, trade_date)
);
ALTER TABLE bb_daily_price_pilot.daily_closes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bb_daily_price_pilot.daily_closes FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE bb_daily_price_pilot.daily_closes IS
  'Isolated research pilot; immutable daily close snapshots; no production or trading use.';
COMMIT;

-- Future insertion policy (NOT run automatically):
-- INSERT INTO bb_daily_price_pilot.daily_closes(code,trade_date,close_unadjusted)
-- VALUES ('9984','2026-10-16',4944)
-- ON CONFLICT (code,trade_date) DO NOTHING;
-- Compare existing price against incoming value separately; never silently UPDATE.
-- If corporate actions change historical values, record conflicts for review.
-- Access should use a privileged server-only connection to the DEV database,
-- with a narrowly scoped role to be established before enabling writes.
