-- SHADOW ONLY / READ ONLY. Never substitute a daily close for a 09:05 executable fill.
-- Frozen review as-of 2026-11-06 after JPX close. Change AS_OF_DATE only when
-- running a new, explicitly timestamped follow-up audit. The SQL never sends orders.
-- Source: full daily_stock_results sessions, morning_final_check_runs frozen cohorts
-- and the 08:45 morning_market_forward_runs NASDAQ daily reference.
WITH params AS (SELECT DATE '2026-11-06' AS as_of_date),
full_sessions AS (
  SELECT d.date::date AS session_date
  FROM public.daily_stock_results d, params p
  WHERE d.date ~ '^2026-[0-9]{2}-[0-9]{2}$'
    AND d.date::date <= p.as_of_date
  GROUP BY d.date
  HAVING count(DISTINCT d.code) >= 900
), horizon AS (
  SELECT session_date,
    lead(session_date,3) OVER (ORDER BY session_date) AS plus3,
    lead(session_date,5) OVER (ORDER BY session_date) AS plus5
  FROM full_sessions
), morning AS (
  SELECT f.trade_date, f.prior_date, f.frozen_at,
    item.value->>'code' AS code,
    item.value->>'label' AS label,
    item.value->>'quoteStatus' AS quote_status
  FROM public.morning_final_check_runs f
  CROSS JOIN LATERAL jsonb_array_elements(f.morning_observations) AS item(value)
  CROSS JOIN params p
  WHERE f.trade_date BETWEEN DATE '2026-10-21' AND p.as_of_date
    AND f.prior_date < f.trade_date
    AND f.frozen_at < (f.trade_date::timestamp AT TIME ZONE 'Asia/Tokyo')
), preopen AS (
  SELECT m.trade_date,
    (m.quotes->'nasdaq'->>'changePct')::numeric AS nasdaq_pct,
    m.captured_at
  FROM public.morning_market_forward_runs m
  CROSS JOIN params p
  WHERE m.state = 'COMPLETE'
    AND m.trade_date <= p.as_of_date
    AND m.quotes->'nasdaq'->>'state' = 'REFERENCE'
    AND m.quotes->'nasdaq'->>'quoteDate' < m.trade_date::text
    AND (m.captured_at AT TIME ZONE 'Asia/Tokyo')::date = m.trade_date
    AND (m.captured_at AT TIME ZONE 'Asia/Tokyo')::time BETWEEN TIME '08:00' AND TIME '09:00'
), result AS (
  SELECT mo.trade_date, pr.nasdaq_pct, pr.nasdaq_pct <= -3 AS guard_triggered,
    count(*) AS frozen_count,
    count(*) FILTER (WHERE mo.label = 'BUY_CANDIDATE') AS buy_candidate_labels,
    count(*) FILTER (WHERE mo.label = 'UNAVAILABLE') AS unavailable_labels,
    h.plus3, h.plus5
  FROM morning mo
  JOIN preopen pr ON pr.trade_date = mo.trade_date
  LEFT JOIN horizon h ON h.session_date = mo.trade_date
  GROUP BY mo.trade_date, pr.nasdaq_pct, h.plus3, h.plus5
)
SELECT trade_date, nasdaq_pct, guard_triggered, frozen_count,
  buy_candidate_labels, unavailable_labels,
  plus3, plus5,
  CASE WHEN plus3 IS NULL THEN 'PENDING' ELSE 'DATE_AVAILABLE_REFERENCE_ONLY' END AS horizon3_status,
  CASE WHEN plus5 IS NULL THEN 'PENDING' ELSE 'DATE_AVAILABLE_REFERENCE_ONLY' END AS horizon5_status,
  CASE WHEN buy_candidate_labels = 0 THEN 'NO_VERIFIED_BUY_CANDIDATE'
    ELSE 'VERIFY_CANDLE_AND_FILLABILITY_FIRST' END AS tradable_status
FROM result ORDER BY trade_date DESC;
