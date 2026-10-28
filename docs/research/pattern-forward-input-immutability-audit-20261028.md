# Pattern forward observation immutability audit — 2026-10-28

## Confirmed code path (existing default-branch source)

`app/lib/learning/patternForwardLearning.ts` has `savePatternForwardObservations` using
`ON CONFLICT (trade_date, code, pattern_id) DO UPDATE` to replace
`pattern_name`, `direction`, **`entry_price`**, `confidence`, `pattern_score`,
and `updated_at`. Repeated calls therefore can modify the initial observation.
No confirmed history of actual price overwrites is available in the current table.

`updatePatternForwardOutcomes` updates future result fields using COALESCE;
it does not directly set `entry_price`. An `updated_at` later than `created_at`
is expected for backfilled forward results and is not evidence of initial-price mutation.

## Safe future fix — proposed, not applied

- In a separate explicitly approved implementation PR, replace re-observation conflict
  handling with `ON CONFLICT (trade_date, code, pattern_id) DO NOTHING` or an
  insert-only/immutable-fields path; avoid updating entry_price, direction,
  confidence, pattern_score and pattern_name.
- Keep forward outcome updates separate, only update result/outcome dates.
- Ensure repeat executions cannot alter original inputs even with changed prices.
- Add isolated PostgreSQL test: insert at price 100; replay at 120;
  assert persisted price remains 100; write independent outcomes; confirm
  original price still 100.
- Add source-provenance checks and review origin record's true as-of timestamp
  before any claim of forecasting accuracy.
- Do not retroactively mark any existing records as immutable/verified:
  historical rows may already have been modified.

## Current research status

- Historical price values match same-day daily_stock_results but this does
  not prove they were never rewritten.
- Audit remains READ-ONLY; production DB, existing default-branch source,
  live AI POWER, cron, and notifications unchanged.
- Do not merge this research documentation as an operational fix.
