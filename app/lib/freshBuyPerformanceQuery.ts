export const freshBuyPerformanceSql=`
WITH chosen AS (
 SELECT e.* FROM public.owner_new_buy_events e
 WHERE e.owner_email=$1 AND (NOT $2::boolean OR e.state='SENT')
  AND (NOT $3::boolean OR jsonb_array_length(e.signals)=1)
  AND ($4::text='ALL' OR e.evidence->>'version'=$4)
), families AS (
 SELECT DISTINCT e.owner_email,e.code,e.trade_date,jsonb_array_length(e.signals)>1 AS overlapping,
  CASE s->>'kind' WHEN 'STRUCTURE_pattern031' THEN 'TRIANGLE' WHEN 'STRUCTURE_pattern033' THEN 'TRIANGLE'
   ELSE s->>'kind' END AS family
 FROM chosen e CROSS JOIN LATERAL jsonb_array_elements(e.signals) s
), tracked AS (
 SELECT f.*,h.horizon,o.status,o.return_pct
 FROM families f CROSS JOIN (VALUES(1),(3),(5)) h(horizon)
 LEFT JOIN public.owner_new_buy_outcomes o ON o.owner_email=f.owner_email AND o.code=f.code
  AND o.trade_date=f.trade_date AND o.horizon=h.horizon
 WHERE h.horizon=$6::integer AND f.family IN
 ('HIGH_BREAKOUT','PULLBACK_REBOUND','BB_UP_EXPANSION','TRIANGLE','STRUCTURE_pattern019','STRUCTURE_pattern016','STRUCTURE_pattern017','STRUCTURE_pattern022')
)
SELECT family,horizon,count(*)::int AS total,
 count(*) FILTER(WHERE status='COMPLETE')::int AS completed,
 count(*) FILTER(WHERE status IS NULL OR status IN ('PENDING','DATA_MISSING'))::int AS pending,
 count(*) FILTER(WHERE status IN ('CORPORATE_ACTION_REVIEW','INVALID_EVENT'))::int AS excluded,
 count(*) FILTER(WHERE status='COMPLETE' AND return_pct>$5::numeric)::int AS positive,
 count(*) FILTER(WHERE status='COMPLETE' AND return_pct=$5::numeric)::int AS flat,
 count(*) FILTER(WHERE status='COMPLETE' AND return_pct<$5::numeric)::int AS negative,
 avg(return_pct-$5::numeric) FILTER(WHERE status='COMPLETE')::float8 AS average,
 (percentile_cont(0.5) WITHIN GROUP(ORDER BY return_pct-$5::numeric) FILTER(WHERE status='COMPLETE'))::float8 AS median,
 min(return_pct-$5::numeric) FILTER(WHERE status='COMPLETE')::float8 AS worst,
 count(DISTINCT code) FILTER(WHERE status='COMPLETE')::int AS codes,
 count(DISTINCT trade_date) FILTER(WHERE status='COMPLETE')::int AS dates,
 count(*) FILTER(WHERE overlapping)::int AS overlapping
FROM tracked GROUP BY family,horizon ORDER BY family
`;
