-- READ-ONLY diagnostic. Run ONLY after confirming a nonproduction PostgreSQL target
-- or a separately authorized sanitized replica. NEVER run against production by default.
-- This SQL returns aggregates only: no names, email, credentials or individual trades.
SELECT
  COUNT(*)::bigint AS total_rows,
  COUNT(DISTINCT date)::bigint AS distinct_signal_dates,
  COUNT(DISTINCT code)::bigint AS distinct_stock_codes,
  MIN(date)::text AS first_signal_date,
  MAX(date)::text AS last_signal_date,
  COUNT(*) FILTER (WHERE result='WIN')::bigint AS wins,
  COUNT(*) FILTER (WHERE result='LOSE')::bigint AS losses,
  COUNT(*) FILTER (WHERE result='HOLD')::bigint AS holds,
  COUNT(*) FILTER (WHERE result='UNKNOWN')::bigint AS unknowns,
  COUNT(*) FILTER (WHERE checked_at IS NOT NULL)::bigint AS checked_rows,
  COUNT(*) FILTER (WHERE next_price IS NOT NULL AND next_price>0)::bigint AS future_prices,
  COUNT(*) FILTER (WHERE change_percent IS NOT NULL)::bigint AS return_rows,
  COUNT(*) FILTER (WHERE checked_at IS NOT NULL AND checked_at<=created_at)::bigint AS temporal_conflicts,
  COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Tokyo')::date<>date::date)::bigint AS save_date_mismatches
FROM daily_stock_results;

-- Date coverage, grouped to avoid exposing individual stock decisions.
SELECT date::text AS signal_date,COUNT(*)::bigint AS rows,
 COUNT(*) FILTER (WHERE result IN ('WIN','LOSE'))::bigint AS resolved,
 COUNT(*) FILTER (WHERE checked_at IS NOT NULL)::bigint AS evaluated,
 COUNT(*) FILTER (WHERE next_price IS NOT NULL AND next_price>0)::bigint AS priced
FROM daily_stock_results
GROUP BY date ORDER BY date DESC;

-- Duplicate dates/codes can bias a backtest, even if the primary key differs.
SELECT COUNT(*)::bigint AS duplicate_stock_date_groups,
 COALESCE(SUM(n-1),0)::bigint AS duplicate_extra_rows
FROM (SELECT date,code,COUNT(*) AS n FROM daily_stock_results
 GROUP BY date,code HAVING COUNT(*)>1) duplicates;
