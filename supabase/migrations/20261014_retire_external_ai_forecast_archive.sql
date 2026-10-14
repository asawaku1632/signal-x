-- Explicit owner-approved retirement of the external AI experiment (PR #110).
-- Run after the app no longer serves /admin/external-ai-audit.
-- No references to existing SIGNALX learning, trades, scans, alerts, or entry-time studies.
-- DROP TABLE RESTRICT intentionally refuses an unexpected external dependency.
BEGIN;
DROP TABLE IF EXISTS public.external_ai_forecast_archive RESTRICT;
DROP FUNCTION IF EXISTS public.prevent_external_ai_archive_mutation() RESTRICT;
COMMIT;
