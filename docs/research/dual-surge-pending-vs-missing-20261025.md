# Dual Surge pending-vs-missing distinction — 2026-10-25

## Fix
`nextOpenReturn` now distinguishes:
- a future session index outside the supplied array: `PENDING`
- an observed array slot containing a null entry or exit bar: `EXCLUDED_MISSING_DATA`

Previously both cases could be labeled pending, inflating the number of unresolved outcomes and hiding missing historical rows.

## Regression coverage
Three new tests: null entry, null exit, and future index beyond the available array. Recorded inventory: **129 defined tests** (126 + 3), not an all-suite pass claim.

## Outstanding gates
- GitHub Actions full research-suite result is unverified.
- The frozen 24-event baseline has no authorized immutable event-level ledger or provider snapshot attached; event-by-event replay is incomplete.
- STEP 140 remains incomplete.

Pure research branch only; no main merge, production deployment, provider collection, database mutation, cron or notification changes.
