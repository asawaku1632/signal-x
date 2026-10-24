# STEP 140 readiness gate — 2026-10-25

## Code completed on isolated branch
- Cohort-aware consecutive-event grouping and duplicate signal rejection.
- Baseline reconciliation requires nonnegative integer event counts and checks status/direction upper bounds.
- Chronological holdout rejects impossible ISO dates.
- Manifest and denominator checks now reject negative counts.
- Three additional synthetic integrity tests added in this checkpoint.

## Current research test inventory
118 test definitions (115 recorded previously + 3 new). This is a source inventory, **not** a claim that 118 tests have passed.

## Frozen baseline arithmetic
24 events = 15 five-session matured + 9 pending; 15 matured = 11 positive + 4 negative. 20 selected stocks, 19 eligible, 8035 excluded for unadjusted corporate action. These arithmetic relationships balance. They do **not** establish event-level source reconciliation or predictive performance.

## STEP 140 completion gate — NOT MET
1. Confirm actual GitHub Actions run for the branch and all research tests passing.
2. Obtain authorized, immutable provider rows and reference event identities for the 24-event replay.
3. Reconcile per-event outcomes and excluded corporate actions.
4. Review holdout, overlap and cost sensitivity with sufficient evidence.

No main merge, production deploy, cron, notifications, Supabase write, or automated provider fetch.
