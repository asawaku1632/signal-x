# Dual Surge verification continuation — 2026-10-25

## Changes made
- `chronologicalHoldout` now uses the strict calendar validator for cutoff dates and event dates. Dates such as 2026-02-30 fail closed rather than being normalized by JavaScript.
- Two additional regression tests were committed in `tests/research/dualSurgeRobustness.test.mjs`.
- Research suite definition count is now 115 (previous 113 + 2).

## CI check
- The connected GitHub commit workflow-run query for commit `978b4e189468d5a0ed1c917b6d92462651a142d3` returned an empty list. This connector filters to PR-triggered runs and **cannot establish whether the branch's push-triggered research workflow ran or passed**.
- No all-suite test run result is asserted.

## Data replay
- The historical frozen manifest has only aggregate totals, not an immutable event-level reference list or authorized OHLCV snapshot. A 24-event identity replay cannot be completed from that manifest alone.
- Do not claim 24-event reconciliation, prospective win rates or executable profit.

## Safety
Pure research branch only; no main merge, production deployment, automated provider fetch, Supabase write, cron, or notification modifications.

## Acceptance criteria
A verified GitHub Actions research run and authorized event-level inputs remain required before research reproducibility can be marked complete.
