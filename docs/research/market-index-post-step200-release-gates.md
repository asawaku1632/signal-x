# Market index research — gates before real finalization (after STEP 200)

## Confirmed as of checkpoint
- Research branch: research/market-index-shadow-20261021.
- Latest checkpoint commit 6479ab210e65a3649fa5358ac69058245f77ea75.
- Vercel Preview deployment dpl_ECgRFmgWqnd34UNWSv1tB9M91zGs READY.
- Vercel build logs explicitly show `npm run test:market-index-research && next build`, individual successful test markers, and `Build Completed in /vercel/output [49s]`.
- Existing GitHub `Market index shadow research checks` run 40099771194 completed success.
- The dedicated GitHub eligibility workflow is not independently confirmed to have run successfully. This is separate from the verified Vercel test-first build.

## Blocking gates — no assumptions
1. **Licensed provider**: replace `licensed-provider-pending` only after obtaining an actual provider agreement and verifying the rights to access, retain, transform, and display each Nikkei/TOPIX observation, including usage and redistribution limits.
2. **Rights evidence**: define and verify trusted provenance (provider ID, evidence ID, verification authority, scope, expiry, revocation). A boolean supplied by a caller is not evidence.
3. **Exchange session calendar**: independently source and validate the exchange's real trading days, exceptional closures, half-days, session changes, and timezone. A boolean supplied by a caller is not calendar verification.
4. **Data integrity**: validate index identity, observation timestamp with timezone, freshness, positive finite numeric value, provider response semantics, and replay handling. Clarify whether values are preliminary, intraday, or finalized.
5. **Persistence design**: separately review uniqueness for (index_key, trading_day), idempotent conflict behavior, multi-connection concurrency, provenance audit trail, and immutable finalization semantics. Previous TEMP-table uniqueness tests do not establish persistent uniqueness.
6. **Dev-only verification**: any permanent dev schema change or writes require explicit user approval; do not treat existing unavailable placeholder rows as licensed observations.
7. **Production gate**: explicit approval and separately validated monitoring, rollback, and user-facing labeling required before touching main, production data, live AI POWER, notifications, scheduler, or orders.

## Current status
The eligibility contract is a pure research-only validator of caller assertions, not an authorization service and not a finalization pipeline. No licensed index source, trusted calendar, persistent finalization, or production activation has been established. Do not silently substitute synthetic or public scraped data.

## Suggested next safe work
- Inspect the dedicated eligibility workflow configuration and its registration/status without modifying production.
- Make test results and exact totals observable in Preview logs or a dedicated CI artifact.
- Draft a provider-rights evidence schema and calendar-verification interface as non-operational research contracts, with unit tests; do not connect providers or write DB rows.
