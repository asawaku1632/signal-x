# DEV alternative outcome inventory — read-only audit (2026-10-29)

Project: DEV Supabase `jdtqwryiyxeuoraecorw` only. SELECT-only counts; production was not accessed.

| Table | Rows |
|---|---:|
| `technical_bb_observation_results` | 22 (previously verified: 6 five-session event rows / 4 unique stock-date outcomes / 2 dates) |
| `bb_signal_event_results` | 5 (previously inspected: fixture codes, not independently useful live-market outcomes) |
| `technical_signal_event_results` | 0 |
| `us_economic_market_observations` | 0 |
| `weekly_sector_outcome_audits` | 0 |
| `ai_judgment_fixed_cohort_observations` | 0 |

Additional outcome-related DEV tables were discovered via `information_schema.tables`, but discovery alone does not establish their usable coverage. Prior audits found many other research outcome tables empty. These counts **do not** describe the separate PostgreSQL `daily_stock_results` learning database (connected via `DATABASE_URL`), which was not queried.

## Decision
The checked alternative DEV tables do not presently supply a broad independently evaluated holdout cohort. Do not manufacture sample size by counting multiple event types on the same stock/date or by treating fixture outcomes as real. To expand genuine evidence, first confirm an authorized nonproduction legacy PostgreSQL export or obtain prospective timestamped observations and independently sourced future OHLCV with verified licensing. Preserve read-only and shadow-only boundaries; no AI promotion.
