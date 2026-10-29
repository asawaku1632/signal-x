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
