-- TPR_V1 research-only read-only audit for overwrite risk.
-- An existing observation must not be rewritten with a newer pattern snapshot.
-- This report compares latest pattern features to the features frozen in TPR.
WITH existing AS MATERIALIZED (
 SELECT trade_date,code,created_at,rsi_band,macd_key,vwap_key,ema20_key
 FROM public.trend_pullback_reversal_observations
 WHERE signal_version='TPR_V1' AND validation_mode='FORWARD'
), comparisons AS (
 SELECT e.*,
  (SELECT row_to_json(p) FROM (
   SELECT l.rsi_band,l.macd_key,l.vwap_key,l.ema20_key,l.created_at
   FROM public.pattern_learning_logs l
   WHERE l.trade_date=e.trade_date AND l.code=e.code
   ORDER BY l.created_at DESC LIMIT 1
  ) p) latest_pattern
 FROM existing e
)
SELECT COUNT(*) AS observations,
 COUNT(*) FILTER(WHERE latest_pattern IS NULL) AS missing_latest_pattern,
 COUNT(*) FILTER(WHERE (latest_pattern->>'created_at')::timestamptz>created_at) AS newer_pattern_exists,
 COUNT(*) FILTER(WHERE latest_pattern IS NOT NULL AND (
  rsi_band IS DISTINCT FROM latest_pattern->>'rsi_band'
  OR macd_key IS DISTINCT FROM latest_pattern->>'macd_key'
  OR vwap_key IS DISTINCT FROM latest_pattern->>'vwap_key'
  OR ema20_key IS DISTINCT FROM latest_pattern->>'ema20_key'
 )) AS feature_drift_risk
FROM comparisons;
