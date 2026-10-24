# Dual Surge validation checkpoint — 2026-10-25

## Changes
- Preflight rejects inconsistent OHLC high/low ranges.
- Maturity table rejects unrecognized outcome statuses instead of silently omitting them from matured/pending/excluded counts.
- Two regression test definitions added.

## Status
- 123 research test definitions recorded (121 previously + 2).
- Full GitHub Actions suite has **not** been independently verified as passing.
- The historical frozen manifest provides only aggregate counts. Its 24 event identities and underlying licensed OHLCV rows are not available here; event-level replay remains incomplete.
- STEP 140 remains **incomplete** pending verified CI and event-level reconciliation.

## Isolation
No production merge, deployment, provider collection, cron, notifications or database mutation.
