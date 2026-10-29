# SIGNALX historical learning source map (read-only code audit, 2026-10-29)

Scope: GitHub source inspection only. No production database query, no data migration, no score change.

## Newly identified legacy learning sources

| Source | Evidence in application code | What it provides | Limitation |
| --- | --- | --- | --- |
| PostgreSQL `daily_stock_results` | `app/api/learning/dashboard/route.ts` | WIN/LOSE/HOLD/UNKNOWN counts by code and date; total distinct judged dates | Classification is not an independently verified five-session stock return |
| PostgreSQL `daily_stock_results` | `app/lib/learning/accuracyEvaluator.ts` | Score candidates: `ai_power`, `score`, `final_score`, `ai_score`, `power_score`; AI POWER band-level evaluation | Actual column and historical coverage must be checked on an authorized read-only database |
| Learning daily summary | `app/api/learning/summary/route.ts` | Aggregated daily learning results, first/latest dates, win-rate | No timestamp attestation or price provenance in the route itself |
| SQLite `learning_logs` | `app/api/learning/stats/route.ts` | Historical win/lose and reason-pattern counts | Separate backend from PostgreSQL; do not conflate counts or join without a validated key |

## Required next evidence before promoting a model

1. Identify which database/environment holds the actual historical `daily_stock_results` rows. DEV research event-table totals are not a count of all SIGNALX learning data.
2. Inspect read-only column metadata, min/max dates, unique stock/date counts, and duplicates, without retrieving personal or secret data.
3. Confirm whether the stored score was generated before the evaluation period and whether the win/lose labels use a documented price/horizon rule.
4. Match each original score and outcome by stable stock/date identifiers, quarantine conflicting records, and prevent hindsight leakage.
5. Split by trade date into chronological training/holdout cohorts; compare with a frozen baseline and transaction costs.
6. Keep all research outputs shadow-only. Never modify production prediction, notification, or score weighting without separately authorized release.

## Existing research observation limitations

`technical_bb_observation_results` in DEV contained six 5-trading-day event results but only four distinct stock-date outcomes over two observation dates in the earlier read-only audit. This cannot independently establish improved prediction quality.

This document is a source map, not a claim that the legacy learning dataset has been inspected or that model performance has improved.

## DEV database verification (read-only, 2026-10-29)

A read-only `information_schema.tables` query on DEV project `jdtqwryiyxeuoraecorw` returned **zero matching public tables** for `daily_stock_results` and `learning_logs`. Therefore the PostgreSQL `daily_stock_results` used by the application's learning dashboard is **not present in the audited DEV Supabase public schema**. It may be in a separate PostgreSQL database or environment; this result alone cannot establish where it resides. SQLite `learning_logs` is a separate data source.

No production database was queried. Do not interpret the absence of these two DEV tables as loss or absence of the user's accumulated learning history. Identify the authorized backing store and data provenance before attempting a cross-source join.

## Connection and row lineage (additional code audit)

- `app/lib/postgres.ts` creates a PostgreSQL connection pool from the `DATABASE_URL` environment variable. **The URL's actual destination was not read**; do not assume it is the audited DEV Supabase project.
- `app/lib/dailyLearning.ts` maps `daily_stock_results` fields: `id`, `date`, `code`, `score`, `price`, `next_price`, `change_percent`, `result`, `checked_at`, and `created_at`. The insertion path generates ID `${date}-${code}`, inserts `UNKNOWN`, and uses `ON CONFLICT (id) DO NOTHING`. The evaluation update records later `next_price`, `change_percent`, `result`, and `checked_at`.
- Therefore, this table may allow **original saved score versus later checked outcome** comparisons, but `created_at` and `checked_at` must be validated against the claimed trade dates and provider evidence. `result` is a categorical label, not automatically a verified five-trading-day return.
- `app/lib/db.ts` uses local `data/signalx.db` outside production and `/tmp/signalx.db` in production for SQLite `learning_logs`. This storage is separate from `DATABASE_URL` PostgreSQL; ephemeral production `/tmp` should not be assumed to provide durable historical training data.
- Do not access secrets or environment variables merely to locate data. An explicitly authorized read-only connection audit is required before making any dataset-wide quantity claims.

## Proposed minimal safe audit

```sql
SELECT COUNT(*) AS rows_total,
       COUNT(DISTINCT date) AS distinct_dates,
       COUNT(DISTINCT (date, code)) AS distinct_stock_dates,
       MIN(date) AS first_date, MAX(date) AS last_date,
       COUNT(*) FILTER (WHERE result IN ('WIN','LOSE')) AS judged_rows,
       COUNT(*) FILTER (WHERE checked_at IS NOT NULL) AS checked_rows
FROM daily_stock_results;
```

Run only against an explicitly authorized **read-only** learning database, after verifying its schema. This query is documented but **not executed**.
