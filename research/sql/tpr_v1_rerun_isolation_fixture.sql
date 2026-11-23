-- Execute ONLY on an isolated disposable PostgreSQL test database.
-- Never run this file on production. Transaction rollback is an additional guard.
BEGIN;
CREATE TEMP TABLE tpr_rerun_fixture (
 trade_date date NOT NULL,
 code text NOT NULL,
 observation_flag boolean NOT NULL,
 rsi_band text NOT NULL,
 PRIMARY KEY (trade_date, code)
) ON COMMIT DROP;

INSERT INTO tpr_rerun_fixture (trade_date,code,observation_flag,rsi_band)
VALUES (DATE '2026-10-22','1234',true,'RSI_45_60')
ON CONFLICT (trade_date,code) DO NOTHING;

-- Simulate a later, contradictory snapshot arriving on a cron rerun.
INSERT INTO tpr_rerun_fixture (trade_date,code,observation_flag,rsi_band)
VALUES (DATE '2026-10-22','1234',false,'RSI_OTHER')
ON CONFLICT (trade_date,code) DO NOTHING;

DO $$
BEGIN
 IF (SELECT COUNT(*) FROM tpr_rerun_fixture) <> 1 THEN
  RAISE EXCEPTION 'Duplicate TPR observation created';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM tpr_rerun_fixture
  WHERE trade_date=DATE '2026-10-22' AND code='1234'
    AND observation_flag=true AND rsi_band='RSI_45_60'
 ) THEN
  RAISE EXCEPTION 'Original TPR observation overwritten';
 END IF;
END $$;
ROLLBACK;
