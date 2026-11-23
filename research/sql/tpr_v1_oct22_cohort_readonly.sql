-- Read-only research: TPR_V1 cohort comparison (2026-10-22 vs other dates)
-- No production mutation. Evaluate on distinct trading dates and verify stored results.
WITH observations AS (
 SELECT h.id,h.code,h.trade_date,h.market_pattern,h.rsi_band,h.macd_key,
        h.vwap_key,h.ema20_key,h.prior_3record_return,h.result_5d AS stored_5d
 FROM public.trend_pullback_reversal_observations h
 WHERE h.validation_mode='FORWARD' AND h.signal_version='TPR_V1'
   AND h.observation_flag=true AND h.trade_date<=DATE '2026-10-30'
), outcomes AS (
 SELECT o.*,
   CASE WHEN base.price>0 AND future.price>0
        THEN ROUND((100.0*(future.price-base.price)/base.price)::numeric,4)
   END AS recalculated_5d
 FROM observations o
 LEFT JOIN LATERAL (
   SELECT d.price::numeric AS price FROM public.daily_stock_results d
   WHERE d.code=o.code AND d.date::date=o.trade_date AND d.price>0
   ORDER BY d.created_at DESC LIMIT 1
 ) base ON TRUE
 LEFT JOIN LATERAL (
   SELECT z.price FROM (
     SELECT DISTINCT ON (d.date::date) d.date::date AS trade_date,d.price::numeric AS price
     FROM public.daily_stock_results d
     WHERE d.code=o.code AND d.date::date>o.trade_date
       AND d.date::date<=DATE '2026-10-30' AND d.price>0
     ORDER BY d.date::date,d.created_at DESC
   ) z ORDER BY z.trade_date OFFSET 4 LIMIT 1
 ) future ON TRUE
), cohorts AS (
 SELECT CASE WHEN trade_date=DATE '2026-10-22' THEN '2026-10-22' ELSE 'OTHER_DATES' END AS cohort,
        * FROM outcomes
), grouped AS (
 SELECT 'COHORT' AS dimension,cohort AS bucket,* FROM cohorts
 UNION ALL SELECT 'MARKET',cohort||' / '||COALESCE(market_pattern::text,'UNKNOWN'),* FROM cohorts
 UNION ALL SELECT 'RSI',cohort||' / '||COALESCE(rsi_band::text,'UNKNOWN'),* FROM cohorts
 UNION ALL SELECT 'MACD',cohort||' / '||COALESCE(macd_key::text,'UNKNOWN'),* FROM cohorts
 UNION ALL SELECT 'VWAP',cohort||' / '||COALESCE(vwap_key::text,'UNKNOWN'),* FROM cohorts
 UNION ALL SELECT 'EMA20',cohort||' / '||COALESCE(ema20_key::text,'UNKNOWN'),* FROM cohorts
)
SELECT dimension,bucket,COUNT(*) AS observations,COUNT(DISTINCT code) AS codes,
 COUNT(DISTINCT trade_date) AS trade_dates,COUNT(recalculated_5d) AS evaluable,
 ROUND(AVG(recalculated_5d),4) AS avg_5d,
 ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY recalculated_5d)::numeric,4) AS median_5d,
 ROUND(100.0*COUNT(*) FILTER (WHERE recalculated_5d>0)/NULLIF(COUNT(recalculated_5d),0),2) AS positive_rate_5d,
 ROUND(AVG(prior_3record_return),4) AS avg_prior_3record_return,
 COUNT(*) FILTER (WHERE stored_5d IS NOT NULL AND recalculated_5d IS NOT NULL
                      AND ABS(stored_5d-recalculated_5d)>0.0001) AS mismatches
FROM grouped GROUP BY dimension,bucket ORDER BY dimension,bucket;
