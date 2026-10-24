# Dual Surge research continuation — 2026-10-25

## Committed changes
1. Fixed `groupEvents` to merge consecutive signals **within each cohort**, even when signals from other cohorts are interleaved on the same date.
2. Reject duplicate (cohort, session) signals rather than silently generating duplicate or misleading events.
3. Reject invalid/empty cohorts and duplicate input session keys.
4. Added five synthetic evaluation regression cases covering those paths.
5. Hardened `reconcileBaseline`: all five required counts must be nonnegative safe integers; matured + pending must not exceed total; positive + negative must not exceed matured.
6. Added four synthetic baseline regression cases covering missing and inconsistent counts.

## Status
- Nine new test definitions: recorded total **113** based on previous 104.
- Actual all-suite GitHub Actions pass **not verified**. No real-data 24-event replay.
- These changes are pure research modules on the isolated branch; no main merge, provider fetch, Supabase write, cron, notification or production signal changes.

## Remaining gates
Verify the actual GitHub Actions run; reconcile licensed event-level snapshots; validate adjustment semantics, overlaps, denominator and chronological holdout before any predictive-performance claim.
