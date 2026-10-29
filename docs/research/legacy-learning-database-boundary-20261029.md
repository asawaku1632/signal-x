# Legacy learning database boundary (source inspection)

Source: `app/lib/postgres.ts` initializes a separate `pg.Pool` using the server-only `DATABASE_URL`. `app/lib/dailyLearning.ts` writes to `daily_stock_results`, and `app/api/learning/dashboard/route.ts` reads that same PostgreSQL table.

The learning dashboard's `total`, `win`, `lose`, `hold`, `unknown`, and `dateCount` are **descriptive database counts**, not evidence of independently validated predictive improvement. Its current generated comment says the AI automatically improves as rows accumulate, but the source inspection does not establish any corresponding training/weight update, holdout test, or baseline. Do not infer model retraining from these comments.

The legacy table's known columns are `id,date,code,name,score,price,next_price,change_percent,result,checked_at,created_at`. Its save function inserts `UNKNOWN` with `created_at=NOW()` and later updates outcome fields. Crucially, this schema does **not** store independently attested original signal time, entry/exit quote provenance, trading-session horizon, or model version. Therefore its WIN/LOSE labels must not be treated as independently verified forward-test outcomes.

The audited DEV Supabase `jdtqwryiyxeuoraecorw` did not contain the legacy table; that says nothing about the actual `DATABASE_URL` destination. **No attempt was made to read environment secrets, connect to the unknown PostgreSQL server, or touch production.**

The companion `legacy-daily-stock-results-readonly-audit-20261029.sql` contains aggregate-only SELECT queries for a confirmed nonproduction target or separately authorized sanitized replica. The next legitimate step is to identify the authorized database environment and execute these checks, then compare historical prediction timestamps against independent prices. Never apply historical learning to production AI merely because the row count is high.
