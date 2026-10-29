# DEV legacy research source coverage — 2026-10-29

Read-only audit against DEV Supabase project `jdtqwryiyxeuoraecorw` only. Production was not accessed or modified.

| Table | Rows | Five-day completed prices | Distinct source dates |
|---|---:|---:|---:|
| `owner_post_sale_audits` | 0 | 0 | 0 |
| `swing_exit_audits` | 0 | 0 | 0 |
| `entry_time_shadow_runs` | 0 | 0 | 0 |
| `market_index_research_runs` | 4 | n/a | 0 observed dates |

The market index table records execution/status checks, not stock-specific independent forward returns. No model improvement or strategy performance can be inferred from these counts.

The separate PostgreSQL `daily_stock_results` referenced in the application source has **not** been audited here. It may be outside this DEV Supabase project; do not treat the empty tables above as proof that accumulated SIGNALX learning data is missing. The safe next step is to identify the database owner and access scope and perform SELECT-only aggregate checks against the correct nonproduction source or a sanitized export. Never retrieve production credentials or access production without explicit authorization.

For five-session outcome promotion, verify original frozen signal time, independently sourced entry/exit prices and timestamps, actual trading-session calendar, market regime, fees/slippage, frozen baseline, and untouched chronological holdout. All current modules are shadow-only; no production AI or notifications changed.
