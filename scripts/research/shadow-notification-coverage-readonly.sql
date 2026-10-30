-- Read-only coverage inventory for the offline shadow-notification gate.
-- Development DB counts are not a proxy for production learning history.
SELECT 'technical_bb_observation_snapshots' AS source,
       count(*)::bigint AS rows,
       count(DISTINCT code)::bigint AS stocks,
       count(DISTINCT observation_date)::bigint AS trading_days,
       count(DISTINCT to_char(observation_date,'YYYY-MM'))::bigint AS months
FROM public.technical_bb_observation_snapshots
UNION ALL
SELECT 'research_scan_feature_captures',count(*),
       count(DISTINCT code),count(DISTINCT trade_date),
       count(DISTINCT to_char(trade_date,'YYYY-MM'))
FROM public.research_scan_feature_captures
UNION ALL
SELECT 'entry_time_shadow_runs',count(*),NULL::bigint,
       count(DISTINCT trade_date),
       count(DISTINCT to_char(trade_date,'YYYY-MM'))
FROM public.entry_time_shadow_runs;

-- Do not interpret indicator rows as forward outcomes.
SELECT timeframe,provider,timezone,
       count(*)::bigint AS rows,
       count(*) FILTER (WHERE close>0 AND bar_end_at IS NOT NULL)::bigint
         AS structurally_plausible_daily_rows,
       count(*) FILTER (WHERE metadata ? 'independent_feature_generated_at')::bigint
         AS explicit_feature_proof_keys
FROM public.technical_bb_observation_snapshots
GROUP BY timeframe,provider,timezone
ORDER BY rows DESC;
