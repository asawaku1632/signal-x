# TPR_V1 price lookup performance verification (2026-10-31)

## Production observations (read-only)
- `daily_stock_results`: 73,195 rows; `date` is TEXT; only the `id` primary-key index exists.
- All 73,195 stored dates match YYYY-MM-DD, with no NULLs and no out-of-range months or day-of-month values (calendar validity is a separate check).
- The outcome SQL changed from `date::date` predicates to ISO text comparisons.
- Without a new index, production EXPLAIN still chooses sequential scans of `daily_stock_results`; estimated total cost remains ~499,042. **The query rewrite alone is not a demonstrated speedup.**

## Isolated test (rolled back)
- Created 73,195 synthetic price rows in a temporary table.
- Created a temporary btree index on `(code, date, created_at DESC)`, ran ANALYZE.
- Without disabling sequential scans, `EXPLAIN (ANALYZE, BUFFERS)` chose Index Scan for one stock/date-range query, fetching 5 rows in **0.081 ms** (execution time; planning 0.249 ms).
- This is **not** a measurement of the full TPR UPDATE, nor a production benchmark.

## Safety gate before any production change
1. Validate calendar dates and future input normalization.
2. Verify duplicate-date handling and outcome parity on isolated fixtures.
3. Review index creation overhead and disk cost; obtain approval before production schema changes.
4. Benchmark the full update against a representative isolated dataset, preserving existing non-NULL outcomes.
5. Do not enable notifications on the basis of this performance work. TPR_V1 forward edge remains unverified outside the Oct 22 cohort.

No production DDL, DML, deployment, merge, or notification change was performed.


## Full outcome UPDATE benchmark — isolated database
- Test: 73,195 synthetic daily-stock rows, 78 pending TPR observations, composite btree index `(code, date, created_at DESC)`.
- Executed the same `WITH pending, prices ... UPDATE` query shape as the application, including 1d/3d/5d COALESCE guards and duplicate-day selection.
- `EXPLAIN (ANALYZE, BUFFERS)` measured **Execution Time: 6.460 ms**; **Planning Time: 1.938 ms**.
- PostgreSQL chose Index Scan for both base and future stock-price lookups.
- All test tables were TEMP with `ON COMMIT DROP`; no persistent schema/data writes.
- This benchmark is synthetic, not production, and does not include cron scheduling, network latency, concurrent writes, index creation cost, or production table skew.
- A separate isolated functional fixture completed 78/78 five-day outcomes and preserved 26 existing one-day outcomes.
- **No production migration or deployment authorized by this benchmark.**
