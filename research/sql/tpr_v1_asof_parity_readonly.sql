-- TPR_V1 read-only comparison: original vs as-of-safe inputs.
-- Inspect before any production write. pattern created_at is timestamptz;
-- daily_stock_results.created_at is timestamp without time zone, assumed UTC.
WITH latest AS (
 SELECT DISTINCT ON (p.code,p.trade_date)
   p.code,p.trade_date,p.rsi_band,p.macd_key,p.vwap_key,p.ema20_key,p.created_at
 FROM public.pattern_learning_logs p
 WHERE p.trade_date BETWEEN DATE '2026-10-08' AND DATE '2026-10-23'
 ORDER BY p.code,p.trade_date,p.created_at DESC
), inputs AS (
 SELECT p.*,
  (SELECT d.price::numeric FROM public.daily_stock_results d
   WHERE d.code=p.code AND d.date::date=p.trade_date AND d.price>0
   ORDER BY d.created_at DESC LIMIT 1) old_price,
  (SELECT d.price::numeric FROM public.daily_stock_results d
   WHERE d.code=p.code AND d.date::date=p.trade_date AND d.price>0
     AND d.created_at <= (p.created_at AT TIME ZONE 'UTC')
   ORDER BY d.created_at DESC LIMIT 1) safe_price,
  (SELECT d.price::numeric FROM public.daily_stock_results d
   WHERE d.code=p.code AND d.date::date<p.trade_date AND d.price>0
   ORDER BY d.date::date DESC OFFSET 2 LIMIT 1) old_prior,
  (SELECT h.price FROM (
    SELECT DISTINCT ON (d.date::date) d.date::date AS trade_date,d.price::numeric AS price
    FROM public.daily_stock_results d
    WHERE d.code=p.code AND d.date::date<p.trade_date AND d.price>0
      AND d.created_at <= (p.created_at AT TIME ZONE 'UTC')
    ORDER BY d.date::date DESC,d.created_at DESC
   ) h ORDER BY h.trade_date DESC OFFSET 2 LIMIT 1) safe_prior
 FROM latest p
), classified AS (
 SELECT *,
  (rsi_band='RSI_45_60' AND macd_key='MACD_GC' AND vwap_key='VWAP_BELOW'
   AND ema20_key='EMA20_ABOVE' AND old_prior>0
   AND 100.0*(old_price-old_prior)/old_prior < -5) AS old_flag,
  (rsi_band='RSI_45_60' AND macd_key='MACD_GC' AND vwap_key='VWAP_BELOW'
   AND ema20_key='EMA20_ABOVE' AND safe_prior>0
   AND 100.0*(safe_price-safe_prior)/safe_prior < -5) AS safe_flag
 FROM inputs
)
SELECT trade_date,COUNT(*) AS pattern_rows,
 COUNT(*) FILTER(WHERE old_flag IS TRUE) AS original_candidates,
 COUNT(*) FILTER(WHERE safe_flag IS TRUE) AS asof_candidates,
 COUNT(*) FILTER(WHERE old_flag IS DISTINCT FROM safe_flag) AS changed_flags,
 COUNT(*) FILTER(WHERE old_price IS DISTINCT FROM safe_price) AS changed_base_prices,
 COUNT(*) FILTER(WHERE old_prior IS DISTINCT FROM safe_prior) AS changed_prior_prices,
 COUNT(*) FILTER(WHERE safe_price IS NULL) AS missing_asof_prices
FROM classified GROUP BY trade_date ORDER BY trade_date;
