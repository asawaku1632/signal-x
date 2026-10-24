# Frozen WATCH holdout: read-only connection audit (2026-10-24)

Research branch only. Added `app/lib/learning/watchPowerHoldoutAdapter.ts`: a pure conversion layer from SQL row fields (`code`, `trade_date`, `decision_status`, `ai_power`, `return_5d`) to the frozen holdout evaluator. It does **not** connect to Supabase, schedule jobs, expose an API, or mutate production.

Read-only production audit, WATCH labels after the 2026-10-16 training cutoff:

| Signal date | WATCH records | Mature 5d outcomes |
|---|---:|---:|
| 2026-10-19 | 88 | 0 |
| 2026-10-20 | 74 | 0 |
| 2026-10-21 | 84 | 0 |
| 2026-10-22 | 60 | 0 |
| 2026-10-23 | 91 | 0 |
| **Total** | **397** | **0** |

Holdout comparison cannot be evaluated yet. Missing outcomes must not be scored as zero, and this is not evidence for or against the frozen hypothesis. The source is production but SELECT-only. The adapter has not been integrated into a protected route or executed in CI; unit/integration testing remains pending. No trade recommendations, notifications, cron, migrations, or production changes.
