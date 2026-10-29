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

-- Feature availability is useful for daily analogs, but does NOT prove intraday outcomes.
SELECT timeframe,provider,count(*)::bigint AS observations,
       count(*) FILTER (WHERE bar_start_at IS NOT NULL AND bar_end_at IS NOT NULL)::bigint AS with_bar_bounds,
       count(*) FILTER (WHERE provider_timestamp IS NOT NULL)::bigint AS with_provider_timestamp,
       count(*) FILTER (WHERE volume_ratio_20 IS NOT NULL)::bigint AS with_volume_ratio,
       count(*) FILTER (WHERE rsi14 IS NOT NULL)::bigint AS with_rsi,
       count(*) FILTER (WHERE macd IS NOT NULL)::bigint AS with_macd
FROM public.technical_bb_observation_snapshots
GROUP BY timeframe,provider
ORDER BY observations DESC;

-- Distinguish insertion time, source timestamp and bar completion.
-- Insertion after bar end alone does not prove a finalized source candle.
SELECT count(*)::bigint AS total,
       count(*) FILTER (WHERE created_at >= bar_end_at)::bigint AS created_after_bar_end,
       count(*) FILTER (WHERE created_at < bar_end_at)::bigint AS created_before_bar_end,
       count(*) FILTER (WHERE provider_timestamp >= bar_end_at)::bigint AS provider_stamp_after_bar_end,
       count(*) FILTER (WHERE provider_timestamp < bar_end_at)::bigint AS provider_stamp_before_bar_end
FROM public.technical_bb_observation_snapshots;
