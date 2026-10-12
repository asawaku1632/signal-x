-- Extend the existing observational-only golden-zone sample schedule.
-- Apply this migration BEFORE deploying the three new runner jobs.
-- Existing rows, keys, outcome labels, AI POWER, notifications and trades are unchanged.
-- Uses a short lock timeout so the change fails safely rather than blocking writes.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.golden_zone_observations
  DROP CONSTRAINT IF EXISTS golden_zone_observations_time_slot_check;
ALTER TABLE public.golden_zone_observations
  ADD CONSTRAINT golden_zone_observations_time_slot_check
    CHECK (time_slot IN ('09:15','09:30','10:30','12:40','13:00','14:30','15:15'));
COMMENT ON TABLE public.golden_zone_observations IS
  'Admin-only observation. Up to 30 cached high-ranked scan stocks at seven JST timestamps; compares their snapshot prices with next TSE trading day daily_stock_results reference prices. Never influences AI/trades/notifications.';
COMMIT;
