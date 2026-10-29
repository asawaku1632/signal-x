-- Offline research readiness inventory. SELECT only; no schema/data mutations.
-- Run against an explicitly selected development database, not production by default.
-- Counts are actual rows, not pg_stat estimates.
SELECT 'technical_bb_observation_snapshots' AS dataset, count(*)::bigint AS stored_rows,
       count(DISTINCT code)::bigint AS distinct_stocks,
       count(DISTINCT observation_date)::bigint AS distinct_dates,
       count(DISTINCT to_char(observation_date,'YYYY-MM'))::bigint AS distinct_months
FROM public.technical_bb_observation_snapshots
UNION ALL
SELECT 'entry_time_shadow_runs',count(*)::bigint,0::bigint,count(DISTINCT trade_date)::bigint,
       count(DISTINCT to_char(trade_date,'YYYY-MM'))::bigint
FROM public.entry_time_shadow_runs
UNION ALL
SELECT 'research_scan_feature_captures',count(*)::bigint,0::bigint,0::bigint,0::bigint
FROM public.research_scan_feature_captures;
-- This inventory cannot establish complete 09:00-11:30 five-minute OHLC coverage.
-- Never convert counts of saved indicators into intraday-bar or rebound sample counts.
