-- PR #217 isolated PostgreSQL database contract test
-- STRICT PRECONDITION: a disposable GitHub Actions service DB.
-- Validates database name + role. The workflow pins the client host to 127.0.0.1.
-- Container-side inet_server_addr() is NOT necessarily loopback.
-- Never run in Supabase SQL Editor or with production credentials.
\set ON_ERROR_STOP on
DO $isolation_guard$
BEGIN
  IF current_database() <> 'signalx_alpha217_ci'
     OR current_user <> 'test_only' THEN
    RAISE EXCEPTION 'Refusing non-isolated DB: database=%, role=%',
      current_database(), current_user;
  END IF;
  RAISE NOTICE 'Isolated database guard passed';
END
$isolation_guard$;
BEGIN;
SET LOCAL statement_timeout = '15s';
CREATE TEMP TABLE swing_universe_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trade_date date NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  entry_price numeric(16,4) NOT NULL CHECK (entry_price > 0),
  ai_power numeric(7,2) NOT NULL CHECK (ai_power BETWEEN 0 AND 100),
  decision_status text NOT NULL
    CHECK (decision_status IN ('CANDIDATE','WAIT','WATCH','AVOID')),
  decision_label text NOT NULL,
  rule_version text NOT NULL DEFAULT 'ai_power_only_v1',
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trade_date,code)
) ON COMMIT DROP;
CREATE TEMP TABLE daily_stock_results (
 date text NOT NULL, code text NOT NULL, name text NOT NULL,
 score numeric, price numeric
) ON COMMIT DROP;
INSERT INTO daily_stock_results(date,code,name,score,price) VALUES
 ('2026-10-26','590A','Test Alpha 1',30,100),
 ('2026-10-26','641A','Test Alpha 2',70,200),
 ('2026-10-26','642A','Test Alpha 3',77,300),
 ('2026-10-26','7203','Test Numeric 1',90,400),
 ('2026-10-26','1301','Test Numeric 2',60,500);
DO $$
DECLARE v_rows int; v_replayed int;
BEGIN
  WITH source_data AS (
    SELECT date::date AS trade_date, code, name, price AS entry_price,
      score AS ai_power,
      CASE WHEN score<65 THEN 'AVOID'
           WHEN score<75 THEN 'WATCH'
           WHEN score<85 THEN 'WAIT' ELSE 'CANDIDATE' END AS decision_status,
      CASE WHEN score<65 THEN '見送り'
           WHEN score<75 THEN '様子見'
           WHEN score<85 THEN '押し目待ち' ELSE 'スイング候補' END AS decision_label
    FROM daily_stock_results
    WHERE date='2026-10-26'
      AND code ~ '^(?:[0-9]{4}|[0-9]{3}[A-Z])$'
  )
  INSERT INTO swing_universe_observations
    (trade_date,code,name,entry_price,ai_power,decision_status,decision_label,rule_version)
  SELECT trade_date,code,name,entry_price,ai_power,decision_status,decision_label,'ai_power_only_v1'
  FROM source_data
  ON CONFLICT(trade_date,code) DO NOTHING;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>5 THEN RAISE EXCEPTION 'Expected 5 inserts; got %',v_rows; END IF;

  INSERT INTO swing_universe_observations
    (trade_date,code,name,entry_price,ai_power,decision_status,decision_label,rule_version)
  SELECT trade_date,code,name,entry_price,ai_power,decision_status,decision_label,rule_version
  FROM swing_universe_observations
  ON CONFLICT(trade_date,code) DO NOTHING;
  GET DIAGNOSTICS v_replayed=ROW_COUNT;
  IF v_replayed<>0 THEN RAISE EXCEPTION 'Replay inserted % rows',v_replayed; END IF;

  IF (SELECT count(*) FROM swing_universe_observations WHERE code ~ '^[0-9]{3}[A-Z]$')<>3
     OR (SELECT count(*) FROM swing_universe_observations WHERE code ~ '^[0-9]{4}$')<>2
  THEN RAISE EXCEPTION 'Unexpected alpha/numeric distribution'; END IF;

  BEGIN
    INSERT INTO swing_universe_observations
      (trade_date,code,name,entry_price,ai_power,decision_status,decision_label)
    VALUES ('2026-10-26','999A','Invalid',10,130,'CANDIDATE','スイング候補');
    RAISE EXCEPTION 'Invalid value unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  IF (SELECT count(*) FROM swing_universe_observations)<>5 THEN
    RAISE EXCEPTION 'Failed rollback or row count drift';
  END IF;
  RAISE NOTICE 'PASS: 5 inserts, alpha 3, numeric 2, replay 0, constraint rollback';
END $$;
SELECT code,decision_status,ai_power
FROM swing_universe_observations ORDER BY code;
ROLLBACK;
