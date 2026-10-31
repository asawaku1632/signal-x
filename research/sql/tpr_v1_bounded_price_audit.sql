-- Read-only bounded TPR_V1 audit for a single observation date.
-- Change the date to audit another cohort; no INSERT/UPDATE/DELETE.
WITH cohort AS MATERIALIZED (
 SELECT code,trade_date,created_at
 FROM public.trend_pullback_reversal_observations
 WHERE signal_version='TPR_V1'
 AND validation_mode='FORWARD'
 AND observation_flag=true
 AND trade_date=DATE '2026-10-22'
), checked AS (
 SELECT c.*,
  (SELECT d.price FROM public.daily_stock_results d
   WHERE d.code=c.code AND d.date=c.trade_date::text AND d.price>0
   ORDER BY d.created_at DESC LIMIT 1) latest_price,
  (SELECT d.price FROM public.daily_stock_results d
   WHERE d.code=c.code AND d.date=c.trade_date::text AND d.price>0
   AND d.created_at <= (c.created_at AT TIME ZONE 'UTC')
   ORDER BY d.created_at DESC LIMIT 1) asof_price
 FROM cohort c
)
SELECT COUNT(*) AS observations,
 COUNT(*) FILTER (WHERE latest_price IS DISTINCT FROM asof_price) AS price_mismatches,
 COUNT(*) FILTER (WHERE asof_price IS NULL) AS missing_asof
FROM checked;
