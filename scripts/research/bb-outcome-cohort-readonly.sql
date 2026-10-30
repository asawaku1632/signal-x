-- Offline-only inventory: daily BB event outcomes, not verified morning alerts.
-- Event rows can share the same stock-day; NEVER count them as independent samples.
SELECT r.horizon,r.horizon_unit,r.result_quality,
       count(*)::bigint AS result_rows,
       count(DISTINCT e.id)::bigint AS events,
       count(DISTINCT s.code||'|'||s.observation_date::text)::bigint AS unique_stock_days,
       count(DISTINCT s.code)::bigint AS stocks,
       count(DISTINCT s.observation_date)::bigint AS trading_days,
       count(*) FILTER (WHERE r.return_percent IS NOT NULL)::bigint AS with_returns,
       count(*) FILTER (WHERE r.return_percent>0)::bigint AS positive_event_rows,
       round(avg(r.return_percent),4) AS mean_event_return_pct
FROM public.technical_bb_observation_results r
JOIN public.technical_bb_observation_events e ON e.id=r.event_id
JOIN public.technical_bb_observation_snapshots s ON s.id=e.snapshot_id
WHERE r.horizon_unit='TRADING_DAY'
GROUP BY 1,2,3
ORDER BY 1,2,3;

-- Duplicate event outcomes must be resolved by a preregistered cohort policy.
-- No model predictions, source licensing or point-in-time proof is inferred.
SELECT r.horizon,s.code,s.observation_date,count(*)::bigint AS event_rows
FROM public.technical_bb_observation_results r
JOIN public.technical_bb_observation_events e ON e.id=r.event_id
JOIN public.technical_bb_observation_snapshots s ON s.id=e.snapshot_id
WHERE r.horizon_unit='TRADING_DAY' AND r.result_quality='COMPLETE'
GROUP BY 1,2,3 HAVING count(*)>1
ORDER BY r.horizon,s.observation_date,s.code;
