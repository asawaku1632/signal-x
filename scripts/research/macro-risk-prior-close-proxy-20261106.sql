-- Research-only prior-close reference stress check, NOT an entry/exit replay.
-- As-of preopen 2026-11-06, candidate prices/scores saved 2026-11-05 15:35 JST.
-- Every comparison with 2026-11-06 saved price is FUTURE OUTCOME, used only
-- retrospectively after JPX close. Real 09:05 BUY_CANDIDATE coverage was 0.
-- 100 shares per hypothetical candidate, <=380000 JPY prior saved reference cost.
WITH morning AS (
  SELECT trade_date,captured_at,
    (quotes->'nasdaq'->>'changePct')::numeric AS nasdaq_pct
  FROM public.morning_market_forward_runs
  WHERE trade_date=DATE '2026-11-06' AND state='COMPLETE'
    AND quotes->'nasdaq'->>'state'='REFERENCE'
    AND quotes->'nasdaq'->>'quoteDate'='2026-11-05'
    AND (captured_at AT TIME ZONE 'Asia/Tokyo')::time BETWEEN TIME '08:00' AND TIME '09:00'
), prior AS (
  SELECT d.code,d.score,d.price AS reference_prev, m.nasdaq_pct
  FROM public.daily_stock_results d CROSS JOIN morning m
  WHERE d.date='2026-11-05' AND d.score>=85 AND d.price>0
    AND d.price*100 <=380000
    AND (d.created_at AT TIME ZONE 'UTC') < m.captured_at
), later AS (
  SELECT p.code,p.score,p.reference_prev,p.nasdaq_pct,
    d.price AS reference_next,
    (d.price-p.reference_prev)*100 AS reference_difference_100_shares
  FROM prior p
  LEFT JOIN public.daily_stock_results d
    ON d.date='2026-11-06' AND d.code=p.code AND d.price>0
)
SELECT count(*) AS candidate_count,
  count(reference_next) AS matched_later_close_reference,
  count(*) FILTER(WHERE reference_difference_100_shares<0) AS reference_down,
  count(*) FILTER(WHERE reference_difference_100_shares>0) AS reference_up,
  count(*) FILTER(WHERE reference_difference_100_shares=0) AS reference_unchanged,
  round(avg(reference_difference_100_shares)::numeric,2) AS average_reference_difference_yen,
  min(nasdaq_pct) AS preopen_saved_nasdaq_pct
FROM later;
