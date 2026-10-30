-- Read-only PostgreSQL regression fixture for pattern forward classification.
-- Run in a disposable/dev database. No schema or data mutations.
WITH observations AS (
 SELECT 'too_few_days' AS scenario, 'S'||g AS code,
 ('2026-10-01'::date + (g%16)) AS trade_date, 'BUY' AS direction,
 CASE WHEN g%16<6 THEN 1.2::numeric END AS return_5d,
 CASE WHEN g%16<6 THEN true END AS success_5d
 FROM generate_series(0,159) g
 UNION ALL
 SELECT 'valid','V'||g,('2026-10-01'::date+(g%16)),'BUY',1.2::numeric,true FROM generate_series(0,79) g
 UNION ALL
 SELECT 'low_win','L'||g,('2026-10-01'::date+(g%16)),'BUY',
 CASE WHEN g%2=0 THEN 1.2::numeric ELSE -1.2::numeric END,(g%2=0)
 FROM generate_series(0,79) g
 UNION ALL
 SELECT 'neutral','N'||g,('2026-10-01'::date+(g%16)),'NEUTRAL',1.2::numeric,true
 FROM generate_series(0,79) g
), aggregates AS (
 SELECT scenario,MAX(direction) AS direction,COUNT(return_5d) AS completed,
 COUNT(DISTINCT code) FILTER (WHERE return_5d IS NOT NULL) AS completed_codes,
 COUNT(DISTINCT trade_date) FILTER (WHERE return_5d IS NOT NULL) AS completed_dates,
 100.0*COUNT(*) FILTER (WHERE success_5d IS TRUE)/NULLIF(COUNT(success_5d),0) AS win_rate,
 AVG(CASE WHEN direction='BUY' THEN return_5d WHEN direction='SELL' THEN -return_5d END) AS avg_directional,
 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN direction='BUY' THEN return_5d WHEN direction='SELL' THEN -return_5d END) AS median_directional
 FROM observations GROUP BY scenario
), classified AS (
 SELECT scenario, CASE
 WHEN direction='NEUTRAL' THEN 'OBSERVATION_ONLY'
 WHEN completed>=50 AND completed_codes>=30 AND completed_dates>=15 AND win_rate>=60 AND avg_directional>=0.5 AND median_directional>0 THEN 'VALIDATED'
 WHEN completed>=20 AND completed_codes>=15 AND completed_dates>=8 AND win_rate>=55 AND avg_directional>0 THEN 'PROMISING'
 ELSE 'COLLECTING' END AS actual
 FROM aggregates
), checked AS (
 SELECT scenario,actual,
 CASE scenario
 WHEN 'too_few_days' THEN 'COLLECTING'
 WHEN 'valid' THEN 'VALIDATED'
 WHEN 'low_win' THEN 'COLLECTING'
 WHEN 'neutral' THEN 'OBSERVATION_ONLY' END AS expected
 FROM classified
)
SELECT scenario,actual,expected,actual=expected AS passed FROM checked ORDER BY scenario;
