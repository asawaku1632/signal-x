-- SHADOW ONLY / read-only historical reference replay.
-- Data: SIGNALX production public DB, as stored by 2026-11-06 close.
-- Does NOT simulate actual brokerage fills, quote availability at snapshot label,
-- 3/5-session outcomes, or risk-adjusted profitability.
-- Preconditions: 100 shares; reference cost <= JPY 500k.
-- Predeclared trigger: previous US session NASDAQ reference change <= -3%.
-- Cohort must be fixed the prior JPX trading session; join by exact code/rank/score.
-- Stocks are compared only if BOTH snapshot timestamps and underlying quote
-- timestamps are consistent with their original JST session windows.
-- Derived numbers are counterfactual reference-only, NEVER "actual losses saved".

WITH market_source AS (
 SELECT trade_date, captured_at, state,
        quotes->'nasdaq'->>'state' AS quote_state,
        quotes->'nasdaq'->>'quoteDate' AS us_session_date,
        (quotes->'nasdaq'->>'changePct')::numeric AS nasdaq_pct,
        count(*) OVER (PARTITION BY trade_date) AS market_day_records
 FROM public.morning_market_forward_runs
 WHERE trade_date BETWEEN DATE '2026-10-21' AND DATE '2026-11-06'
),
market AS (
 SELECT * FROM market_source
 WHERE market_day_records = 1 AND state = 'COMPLETE' AND quote_state = 'REFERENCE'
 AND us_session_date < trade_date::text
 AND nasdaq_pct BETWEEN -50 AND 50
 AND (captured_at AT TIME ZONE 'Asia/Tokyo')::date = trade_date
 AND (captured_at AT TIME ZONE 'Asia/Tokyo')::time BETWEEN TIME '08:00' AND TIME '09:00'
),
frozen AS (
 SELECT f.trade_date, f.prior_date, f.frozen_at,
        j.item->>'code' AS code, (j.item->>'rank')::integer AS prior_rank,
        (j.item->>'score')::numeric AS prior_score
 FROM public.morning_final_check_runs f
 CROSS JOIN LATERAL jsonb_array_elements(f.cohort) AS j(item)
 WHERE f.trade_date BETWEEN DATE '2026-10-21' AND DATE '2026-11-06'
 AND f.prior_date < f.trade_date
 AND (f.frozen_at AT TIME ZONE 'Asia/Tokyo')::date = f.prior_date
 AND f.frozen_at < (f.trade_date::timestamp AT TIME ZONE 'Asia/Tokyo')
),
morning AS (
 SELECT trade_date, code, prior_date, prior_rank, prior_score,
        entry_price AS morning_price,
        quote_timestamp AS morning_quote_at, snapshot_saved_at AS morning_saved_at
 FROM public.ai_judgment_fixed_cohort_observations
 WHERE time_slot = '09:30' AND trade_date BETWEEN DATE '2026-10-21' AND DATE '2026-11-06'
),
afternoon AS (
 SELECT trade_date, code, prior_date, prior_rank, prior_score,
        entry_price AS afternoon_price,
        quote_timestamp AS afternoon_quote_at, snapshot_saved_at AS afternoon_saved_at
 FROM public.ai_judgment_fixed_cohort_observations
 WHERE time_slot = '15:15' AND trade_date BETWEEN DATE '2026-10-21' AND DATE '2026-11-06'
),
cases AS (
 SELECT f.trade_date, f.code, m.nasdaq_pct,
        (m.nasdaq_pct <= -3) AS pause,
        o.morning_price, a.afternoon_price,
        (o.morning_price * 100 <= 500000 AND o.morning_price > 0) AS budget,
        (
          o.morning_price > 0 AND a.afternoon_price > 0
          AND (o.morning_quote_at AT TIME ZONE 'Asia/Tokyo')::date = f.trade_date
          AND (o.morning_saved_at AT TIME ZONE 'Asia/Tokyo')::date = f.trade_date
          AND (a.afternoon_quote_at AT TIME ZONE 'Asia/Tokyo')::date = f.trade_date
          AND (a.afternoon_saved_at AT TIME ZONE 'Asia/Tokyo')::date = f.trade_date
          AND (o.morning_quote_at AT TIME ZONE 'Asia/Tokyo')::time BETWEEN TIME '09:00' AND TIME '09:45'
          AND (o.morning_saved_at AT TIME ZONE 'Asia/Tokyo')::time BETWEEN TIME '09:30' AND TIME '09:45'
          AND (a.afternoon_quote_at AT TIME ZONE 'Asia/Tokyo')::time BETWEEN TIME '14:45' AND TIME '15:25'
          AND (a.afternoon_saved_at AT TIME ZONE 'Asia/Tokyo')::time BETWEEN TIME '15:00' AND TIME '15:25'
          AND o.morning_quote_at <= o.morning_saved_at
          AND a.afternoon_quote_at <= a.afternoon_saved_at
        ) AS paired_time_ok,
        ((a.afternoon_price - o.morning_price) * 100) AS reference_pnl_yen
 FROM frozen f
 JOIN market m USING (trade_date)
 JOIN morning o ON o.trade_date = f.trade_date AND o.code = f.code
       AND o.prior_date = f.prior_date
       AND o.prior_rank = f.prior_rank AND o.prior_score = f.prior_score
 LEFT JOIN afternoon a ON a.trade_date = f.trade_date AND a.code = f.code
       AND a.prior_date = f.prior_date
       AND a.prior_rank = f.prior_rank AND a.prior_score = f.prior_score
)
SELECT count(DISTINCT trade_date) AS days,
       count(DISTINCT trade_date) FILTER (WHERE pause) AS pause_days,
       count(*) AS frozen_candidates,
       count(*) FILTER (WHERE budget AND paired_time_ok) AS comparable_candidates,
       count(*) FILTER (WHERE budget AND paired_time_ok AND pause) AS pause_comparables,
       count(*) FILTER (WHERE budget AND paired_time_ok AND pause AND reference_pnl_yen < 0) AS pause_down,
       count(*) FILTER (WHERE budget AND paired_time_ok AND pause AND reference_pnl_yen > 0) AS pause_up,
       sum(reference_pnl_yen) FILTER (WHERE budget AND paired_time_ok AND pause) AS pause_net_yen,
       sum(-reference_pnl_yen) FILTER (WHERE budget AND paired_time_ok AND pause AND reference_pnl_yen < 0) AS screened_negative_yen,
       sum(reference_pnl_yen) FILTER (WHERE budget AND paired_time_ok AND pause AND reference_pnl_yen > 0) AS screened_positive_yen
FROM cases;
