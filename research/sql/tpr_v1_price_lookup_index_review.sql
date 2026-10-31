-- TPR_V1 stock-price lookup performance audit (read-only).
-- Run EXPLAIN without ANALYZE on production. No index is created by this file.
-- daily_stock_results.date is TEXT, so date::date predicates need an expression index
-- or a separately validated normalized date column.
-- Proposed index is deliberately COMMENTED OUT: production schema changes require approval.
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS daily_stock_results_code_trade_date_created_idx
-- ON public.daily_stock_results (code, ((date)::date), created_at DESC)
-- INCLUDE (price)
-- WHERE price > 0;
--
-- IMPORTANT: An expression index on date::date may be rejected because the text-to-date
-- cast is not IMMUTABLE. Do not execute this proposed DDL without testing on an isolated DB.
-- Safer alternatives include validating strict ISO date strings and indexing (code,date,created_at)
-- then rewriting the SQL to use lexicographic ISO date comparisons.
--
-- Read-only baseline (no actual execution, no mutations):
EXPLAIN (FORMAT JSON)
SELECT d.price
FROM public.daily_stock_results d
WHERE d.code='1234'
  AND d.date::date=DATE '2026-10-22'
  AND d.price>0
ORDER BY d.created_at DESC
LIMIT 1;
