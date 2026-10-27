# Immutable Scan Feature Capture — research design (2026-10-27)

Status: **DESIGN ONLY / NOT DEPLOYED**. This document changes no runtime code, schema, AI weights, or notifications.

## Observed code path
- `app/api/learning/save-daily/route.ts` fetches `/api/scan?limit=1000`, then invokes `saveDailyStocks(targetDate, stocks)` and `saveRelatedLearning(targetDate, stocks)`.
- `app/lib/relatedLearning.ts` deletes and rebuilds daily experience and pattern rows. Those rows cannot serve as immutable historical feature evidence.
- Existing `daily_stock_results` stores score/price/date but not complete as-of indicator provenance.

## Proposed future capture (requires separate reviewed migration and code PR)
- Append-only research-only table with `capture_id`, `trade_date`, `code`, `captured_at`, `scan_received_at`, `source_bar_at`, `source_name`, `scan_run_id`, `feature_version`, `ai_power`, `entry_price`, `rsi_band`, `trend_key`, `ema20_key`, `vwap_key`, `macd_key`, `pattern_key`, `raw_features_hash`, `capture_status`.
- Store one record per (scan_run_id, code); never update it. Conflicts must not replace old rows.
- Capture source metadata **as received**, and distinguish absent timestamp from verified as-of. Do not infer `source_bar_at` from the request date.
- Exclude cached/stale/unknown-time or future-dated bars from eligible training. Capture them as quarantined for diagnostics, not as confirmed prospective evidence.
- Ensure `captured_at` is server-generated and the capture occurs before any future outcome is available.
- Only join outcome data in a separate read-only research query; never write future results into immutable features.
- Preserve existing production writes and notifications unchanged. No new paid market data providers.

## Verification gates before any deployment
1. Review source timestamps and timezone semantics (JST vs UTC), trading calendar, and provider permissions.
2. Test missing/invalid source timestamps, duplicate scan runs, retries, stale cache, and historical rebuilds.
3. Verify migration/RLS/permissions in development DB first; avoid public anon/authenticated access.
4. Compare eligible capture counts and outcomes using out-of-sample dates; no same-day outcome-derived factors.
5. Human review and explicit approval before production migration or any AI-weight/notification change.

## Prior research
10,483 daily results linked to price provenance (2026-10-09 to 2026-10-26). Experience/pattern logs match by date+code but are saved after original score records; do not claim as-of validity from them.
