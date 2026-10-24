# Dual Surge research — Steps 41–80 (2026-10-24)

**Scope:** isolated branch `fix/dual-surge-dev-db-isolation-20261023`. No production API, Supabase, scheduled job, notification, main merge or automated provider access.

## Implementation and verification ledger

| Step | Work item | State |
|---|---|---|
| 41 | Review prior baseline caveats | Reviewed |
| 42 | Define gross vs net return distinction | Implemented |
| 43 | Model hypothetical round-trip cost | Implemented |
| 44 | Reject negative/implausible cost inputs | Implemented |
| 45 | Preserve pending outcomes after costs | Implemented |
| 46 | Preserve excluded outcomes after costs | Implemented |
| 47 | Compare zero-cost scenario | Implemented |
| 48 | Compare 0.2% cost scenario | Implemented |
| 49 | Compare 0.5% cost scenario | Implemented |
| 50 | Compare 1.0% cost scenario | Implemented |
| 51 | Keep PRE and START cohorts separate | Implemented |
| 52 | Keep 1/3/5/10-session horizons distinct | Implemented |
| 53 | Report net positive/negative counts | Implemented |
| 54 | Report sample-size warning | Implemented |
| 55 | Define same-stock embargo | Implemented |
| 56 | Apply embargo using session indices | Implemented |
| 57 | Retain list of suppressed events | Implemented |
| 58 | Avoid embargo across different stocks | Implemented |
| 59 | Define chronological train/holdout | Implemented |
| 60 | Add conservative calendar-day buffer | Implemented |
| 61 | Distinguish calendar vs trading sessions | Documented |
| 62 | Report whether both partitions exist | Implemented |
| 63 | Group simultaneous signals by date | Implemented |
| 64 | Count matured signals per date | Implemented |
| 65 | Count positive signals per date | Implemented |
| 66 | Report date-level mean gross proxy | Implemented |
| 67 | Add cost arithmetic regression | Test defined |
| 68 | Add pending/cost regression | Test defined |
| 69 | Add invalid-cost regression | Test defined |
| 70 | Add cohort/grid regression | Test defined |
| 71 | Add monotonic cost sensitivity regression | Test defined |
| 72 | Add same-stock overlap regression | Test defined |
| 73 | Add different-stock independence regression | Test defined |
| 74 | Add chronological split regression | Test defined |
| 75 | Add calendar embargo regression | Test defined |
| 76 | Add same-date clustering regression | Test defined |
| 77 | Add invalid horizon regression | Test defined |
| 78 | Add empty holdout regression | Test defined |
| 79 | Register additional test file in CI | Implemented |
| 80 | Record status and release blockers | Documented |

## Deliverables
- `app/lib/research/dualSurgeSensitivity.mjs`: gross vs hypothetical net return scenarios. **Costs are a flat percentage assumption**, not observed commissions, market spread, slippage or fill probability.
- `app/lib/research/dualSurgeRobustness.mjs`: same-stock session-index embargo, chronological holdout with calendar-day gap, and per-date aggregation. **No claims of statistical independence or out-of-sample validation**.
- `tests/research/dualSurgeRobustness.test.mjs`: 12 additional synthetic tests.
- `.github/workflows/dual-surge-research-tests.yml`: updated to include all eight test files.

## Status and limitations
**78 declared tests** (previous 66 plus 12), **not verified passing**. There is no supported Actions run result in the connected tool surface. Do not report a pass rate.

**Historical data replay not performed.** The 20-stock / 24-event frozen baseline is aggregate-only and cannot establish per-event identity. No automated J-Quants fetch or provider-license assertion was made.

**Not yet implemented or verified:** calibrated cost estimates, venue-specific execution constraints, verified trading-session embargo at cross-stock market-calendar level, full event-level reconciliation, walk-forward parameter selection, proper uncertainty intervals, provider rights/AdjFactor semantics, deployment acceptance.

## Next required gate
1. Inspect the actual Actions workflow run and fix any failing tests.
2. Obtain permitted event-level OHLCV inputs and validate corporate-action adjustment semantics.
3. Reproduce 24 event identities and exclusions, then compare gross and hypothetical net returns by cohort and horizon.
4. Audit sample size, overlapping dates, and chronological holdout before making any performance claim.
5. Obtain explicit authorization for any production deployment, automated provider collection or persistent storage.

This milestone represents **research code and test definition**, not a finished trading signal or verified investment advantage.
