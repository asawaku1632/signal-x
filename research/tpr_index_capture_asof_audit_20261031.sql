-- Read-only audit: a daily index close must be available BEFORE a research decision.
-- Do not use this join to mutate historical observations or to claim executable returns.
WITH index_capture AS (
  SELECT trade_date, selected_at, index_source, nikkei_close
  FROM public.crash_forward_events
  WHERE sealed = TRUE AND nikkei_close > 0
),
observations AS (
  SELECT trade_date, created_at
  FROM public.trend_pullback_reversal_observations
)
SELECT o.trade_date,
       COUNT(*) AS observation_count,
       COUNT(*) FILTER (WHERE i.trade_date IS NULL) AS missing_index_capture,
       COUNT(*) FILTER (WHERE i.selected_at > o.created_at) AS future_index_capture,
       COUNT(*) FILTER (WHERE i.selected_at <= o.created_at) AS available_at_decision,
       MIN(o.created_at) AS earliest_decision_at,
       MIN(i.selected_at) AS index_captured_at
FROM observations o
LEFT JOIN index_capture i ON i.trade_date = o.trade_date
GROUP BY o.trade_date
ORDER BY o.trade_date;
