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

-- A retrospective feature row inserted after its observation date must not be
-- presented as a contemporaneous feature snapshot in a walk-forward replay.
-- This measures provenance risk; it does not independently prove publication time.
SELECT count(*)::bigint AS rows_checked,
       count(*) FILTER (WHERE created_at >= (observation_date::timestamp AT TIME ZONE 'Asia/Tokyo') + interval '1 day')::bigint AS inserted_on_or_after_next_jst_day,
       count(*) FILTER (WHERE created_at < (observation_date::timestamp AT TIME ZONE 'Asia/Tokyo') + interval '1 day')::bigint AS inserted_before_next_jst_day
FROM public.technical_bb_observation_snapshots;

-- Structural checks only: matching dates and ordered bounds do not prove
-- exchange-calendar validity, independent provenance, or final candle status.
SELECT count(*)::bigint AS total,
       count(*) FILTER (WHERE bar_start_at < bar_end_at)::bigint AS ordered_bars,
       count(*) FILTER (WHERE (bar_end_at AT TIME ZONE 'Asia/Tokyo')::date=observation_date)::bigint AS end_date_matches_jst,
       count(*) FILTER (WHERE (bar_start_at AT TIME ZONE 'Asia/Tokyo')::date=observation_date)::bigint AS start_date_matches_jst,
       count(*) FILTER (WHERE created_at>=bar_end_at)::bigint AS inserted_after_bar_end,
       count(*) FILTER (WHERE provider_timestamp>=bar_start_at AND provider_timestamp<=bar_end_at)::bigint AS provider_stamp_inside_bar
FROM public.technical_bb_observation_snapshots;

-- Basic indicator arithmetic and range checks; not a predictive accuracy test.
SELECT count(*)::bigint AS total,
       count(*) FILTER (WHERE close>0)::bigint AS positive_close,
       count(*) FILTER (WHERE bb_lower_3<=bb_lower_2 AND bb_lower_2<=bb_lower_1 AND bb_lower_1<=bb_middle AND bb_middle<=bb_upper_1 AND bb_upper_1<=bb_upper_2 AND bb_upper_2<=bb_upper_3)::bigint AS ordered_bands,
       count(*) FILTER (WHERE standard_deviation>=0)::bigint AS nonnegative_deviation,
       count(*) FILTER (WHERE rsi14 BETWEEN 0 AND 100)::bigint AS bounded_rsi,
       count(*) FILTER (WHERE volume_ratio_20>=0)::bigint AS nonnegative_volume_ratio,
       count(*) FILTER (WHERE abs(macd-macd_signal-macd_histogram)<=0.01)::bigint AS macd_arithmetic_consistent
FROM public.technical_bb_observation_snapshots;

-- Check internal Bollinger-band arithmetic; tolerance accommodates rounding.
-- A valid identity does not establish that the underlying source is independent.
SELECT count(*)::bigint AS total,
       count(*) FILTER (WHERE bb_period>0 AND bb_middle>0 AND standard_deviation>=0
         AND abs(bb_upper_1-(bb_middle+standard_deviation))<=0.02
         AND abs(bb_lower_1-(bb_middle-standard_deviation))<=0.02
         AND abs(bb_upper_2-(bb_middle+2*standard_deviation))<=0.02
         AND abs(bb_lower_2-(bb_middle-2*standard_deviation))<=0.02
         AND abs(bb_upper_3-(bb_middle+3*standard_deviation))<=0.02
         AND abs(bb_lower_3-(bb_middle-3*standard_deviation))<=0.02)::bigint AS bands_match_sigma,
       count(*) FILTER (WHERE standard_deviation>0 AND
         abs(bb_sigma_position-((close-bb_middle)/standard_deviation))<=0.02)::bigint AS sigma_position_consistent
FROM public.technical_bb_observation_snapshots;
