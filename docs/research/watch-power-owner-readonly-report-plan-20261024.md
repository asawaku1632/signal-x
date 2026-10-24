# Owner-only prospective WATCH research report: integration contract

Status: design only, not deployed. Verified evaluator and readiness gate unit tests: GitHub Actions [run 40075968515](https://github.com/asawaku1632/signal-x/actions/runs/40075968515), 11/11 pass.

## Safe read-only data flow

1. An existing authenticated owner-only **server** context reads `public.swing_universe_observations` using SELECT only. Do not create a public API route, expose service keys, or bypass existing owner authorization.
2. Query columns `code, trade_date, decision_status, ai_power, return_5d`, filtered by `trade_date > DATE '2026-10-24'` and `decision_status = 'WATCH'`, ordered by date and code. Validate date-only strings and numeric fields before evaluation.
3. Convert through `mapFrozenSwingRows` and pass the result into `getWatchPowerHoldoutReadiness`. Ensure date/status filters are enforced again by the pure evaluator, independent of the SQL filter.
4. Display `COLLECTING` with comparable/remaining dates, `DATA_CONFLICT` if conflicting duplicates, and `REVIEW_READY` only after at least 10 comparable post-freeze dates and no conflicts. Do not display mean return contrasts before review-ready.
5. A 5-trading-day result must come from independently matured stored outcomes; never fill missing values with 0, forward-fill, or query future prices. No notification, buy/sell signal, ranking, scheduler, or automatic trade integration.

## Preconditions before a real owner page

- Identify and reuse the repo's actual owner auth guard and server database connection pattern.
- Validate SELECT rights and RLS with the deployed identity; never introduce broad anon/authenticated grants.
- Verify date parsing, pagination, row counts, and duplicate handling against isolated test fixtures.
- Run build/typecheck and read-only owner integration checks in preview before any explicit production activation.

This contract intentionally stops short of deployment or scheduling.
