# Stage 7 daily 100-stock isolated expansion — design gate

Status: DESIGN ONLY. Not activated; no new vendor calls, migrations, cron, or production changes.

## Existing invariant
The Stage 7 prospective study rotates 20 of 100 frozen codes each trading session. Its daily cap is 20 sampled + 10 pending outcome vendor calls, concurrency 3, no retry. Do not alter its universe, control, run ledger, existing tables, or cron.

## Proposed independent implementation
- New policy and independent version, owner-only OFF-by-default control, separate run/stock-check/signal/outcome/halt tables, no writes to existing Stage 7 tables.
- Freeze and audit the 100-code universe before starting. Use five deterministic 20-code partitions, but process all five on each JPX trading day, subject to measured capacity.
- Claims must be durable and unique per (date, partition, policy_version) BEFORE vendor requests. Do not backfill missed signal days; do not re-request an already claimed partition.
- Each partition has a bounded request budget, concurrency <=3, 12-second source timeout, no automatic retries; separate outcome tracking quota. Do not assume five partitions can fit one serverless invocation.
- Isolate runner invocations per partition and cap global concurrent invocations to prevent provider overload. Use separate schedules only after preview tests, source-policy review, and explicit production authorization.
- Immutable signal source hashes; source revision halts grading; splits excluded; only 1/3/5 trading-day outcomes. No leakage of future candles into signal computation.
- Owner-only access and RLS; no anon/authenticated grants to study data. No change to AI POWER, trading, ranking, or LINE notifications.
- Save observed/failed/new-signals/outcomes, timings, provider requests, claim status, and errors for every partition. PARTIAL/FAILED must not be displayed as full coverage.

## Mandatory gates before deployment
1. Offline tests: partitions are disjoint and cover exactly 100; JPX calendar and no-backfill; idempotent claims; failures/timeout; source revision/splits; budget limits; no cross-table writes.
2. Typecheck and regression tests; preview deployment and access-control tests.
3. Dev-only dry run with injected data and zero vendor requests, then controlled measured dev pilot after explicit authorization.
4. Compare total provider request load and timeouts with current live jobs. If unsafe, stop and revise batching.
5. Separate approval for production migration, cron, and enabling opt-in. Never automatically enable from deployment.

## Scaling decision
100 -> 300 -> 500 -> 950 only after multiple complete observed sessions with verified source success, database reconciliation, bounded costs and stable runtime. Do not equate a 100-code frozen universe with 100 observations per day until verified.
