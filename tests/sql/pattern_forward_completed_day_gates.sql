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

-- Boundary coverage: 20/15/8 minimums, 14-code rejection, SELL normalization.
WITH fixture AS (
 SELECT 'promising' scenario,'P'||g code,('2026-10-01'::date+(g%8)) trade_date,'BUY' direction,1.2::numeric return_5d,true success_5d FROM generate_series(0,19) g
 UNION ALL SELECT 'too_few_codes','X'||(g%14),('2026-10-01'::date+(g%8)),'BUY',1.2::numeric,true FROM generate_series(0,39) g
 UNION ALL SELECT 'sell_valid','Y'||g,('2026-10-01'::date+(g%16)),'SELL',-1.2::numeric,true FROM generate_series(0,79) g
 UNION ALL SELECT 'low_win','Z'||g,('2026-10-01'::date+(g%16)),'BUY',CASE WHEN g%4=0 THEN 4.0::numeric ELSE 0::numeric END,(g%4=0) FROM generate_series(0,79) g
), agg AS (
 SELECT scenario,MAX(direction) direction,COUNT(return_5d) completed,
 COUNT(DISTINCT code) FILTER(WHERE return_5d IS NOT NULL) codes,
 COUNT(DISTINCT trade_date) FILTER(WHERE return_5d IS NOT NULL) days,
 100.0*COUNT(*) FILTER(WHERE success_5d IS TRUE)/NULLIF(COUNT(success_5d),0) win_rate,
 AVG(CASE WHEN direction='BUY' THEN return_5d WHEN direction='SELL' THEN -return_5d END) avg_return,
 PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY CASE WHEN direction='BUY' THEN return_5d WHEN direction='SELL' THEN -return_5d END) median_return
 FROM fixture GROUP BY scenario
), classified AS (
 SELECT scenario,CASE WHEN direction='NEUTRAL' THEN 'OBSERVATION_ONLY'
 WHEN completed>=50 AND codes>=30 AND days>=15 AND win_rate>=60 AND avg_return>=0.5 AND median_return>0 THEN 'VALIDATED'
 WHEN completed>=20 AND codes>=15 AND days>=8 AND win_rate>=55 AND avg_return>0 THEN 'PROMISING'
 ELSE 'COLLECTING' END actual FROM agg
), expected AS (
 SELECT scenario,actual,CASE scenario
 WHEN 'promising' THEN 'PROMISING'
 WHEN 'too_few_codes' THEN 'COLLECTING'
 WHEN 'sell_valid' THEN 'VALIDATED'
 WHEN 'low_win' THEN 'COLLECTING' END expected FROM classified
)
SELECT scenario,actual,expected,actual=expected AS passed FROM expected ORDER BY scenario;
