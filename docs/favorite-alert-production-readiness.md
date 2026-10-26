# Favorite alert production readiness — fail closed

This draft PR must **not** be merged merely because CI and Vercel preview builds pass.

## Required before production rollout

- [ ] Verify commercial and redistribution rights for the selected market-data provider, including notification usage.
- [ ] Implement an independently verifiable provider identity, per-symbol market timestamp, freshness and entitlement checks. Do not enable providers based on an arbitrary string such as `licensed`.
- [ ] Confirm the approved provider's quote fields survive the full scan/notification pipeline; prohibit Yahoo daily fallback for actionable alerts.
- [ ] Apply `20261026090000_favorite_alert_audit.sql` to production with an approved change plan and verify table, RLS and permissions. Development DB testing does not apply this migration to production.
- [ ] Replace the monitor-then-audit two-step operation with an atomic transaction or otherwise prove there is no race or orphan monitor.
- [ ] Test actual cron route behavior with mocked market data, database and LINE/Web Push adapters: stale, missing, future, unknown-source and provider-error cases must send **zero** alerts and create **zero** actionable outcomes.
- [ ] Verify pending historical result alerts cannot be replayed without provenance, including after a future provider is enabled.
- [ ] Confirm notification feature flags, monitoring, rollback, and user-facing language with the operator.
- [ ] Obtain explicit production release approval.

## Current state

The source guard intentionally rejects **all** providers. That is a temporary safety stop, not a licensed-data integration. Existing GitHub Actions tests check helpers and route source ordering; they are **not** end-to-end delivery tests.

The admin-only momentum research alert remains, but no longer fetches or stores an additional Yahoo quote for the alert itself. This does not establish rights for upstream research data.
