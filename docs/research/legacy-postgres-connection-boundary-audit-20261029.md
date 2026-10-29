# Legacy PostgreSQL connection boundary — static source audit, 2026-10-29

Examined source files on research branch, without retrieving environment values or opening a database connection:

- `app/lib/postgres.ts`: constructs a `pg.Pool` from `process.env.DATABASE_URL`. The source does not specify a database hostname or establish whether that environment variable targets production, preview, development, or a replica. **No connection target has been verified.**
- `app/lib/dailyLearning.ts`: `getDailyStockResults()` selects all rows of `daily_stock_results` ordered by `created_at`; `saveDailyStocks()` inserts score, price, name, code, date and `UNKNOWN` result with `NOW()` and ignores duplicate IDs; `updateDailyStockResult()` writes future price, percentage, result and `checked_at=NOW()`.
- These timestamps are not independently authenticated original signal timestamps. No explicit five-trading-day horizon or independent price-provider provenance is attached by the inspected save/update methods.
- `docs/research/legacy-daily-stock-results-readonly-audit-20261029.sql` is a SELECT-only aggregate audit, now with **unlimited date coverage** to permit full daily-vs-global reconciliation. It is **not executed**.

## Safety boundary
Do not print, retrieve, or expose `DATABASE_URL` or credentials. Do not use the deployed app's learning endpoints as a substitute for authorization. Before running the aggregate audit, confirm an isolated nonproduction target or user-authorized sanitized replica, read-only database role, and query limits. Then parse aggregate counts, reconcile dates, and only afterward consider independent outcome attestation and chronological holdout. No production changes or model promotion.
