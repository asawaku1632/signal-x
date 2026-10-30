-- Isolated PostgreSQL UPSERT smoke test. Run only on a disposable/dev database.
-- The temporary table is transaction-scoped; ROLLBACK removes all changes.
BEGIN;
CREATE TEMP TABLE signalx_upsert_test (
 pattern_id text PRIMARY KEY,
 validation_status text NOT NULL,
 status_reason text NOT NULL
) ON COMMIT DROP;
INSERT INTO signalx_upsert_test VALUES ('test_pattern','PROMISING','Early positive forward evidence');
INSERT INTO signalx_upsert_test VALUES ('test_pattern','COLLECTING','Collecting independent 1/3/5-day forward outcomes')
ON CONFLICT(pattern_id) DO UPDATE SET
 validation_status=EXCLUDED.validation_status,
 status_reason=EXCLUDED.status_reason;
SELECT pattern_id,validation_status,status_reason,
 (validation_status='COLLECTING' AND status_reason='Collecting independent 1/3/5-day forward outcomes') AS passed
FROM signalx_upsert_test;
ROLLBACK;
