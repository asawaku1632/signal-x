# Dual Surge — Steps 13–20 review and acceptance (2026-10-24)

**Scope:** `fix/dual-surge-dev-db-isolation-20261023` research branch only. No main merge, production route changes, database writes, cron, or new J-Quants requests.

| Step | Work | Status |
|---|---|---|
| 13 | Check workflow run visibility for previous commit | Checked; PR-filtered workflow-run query returned zero runs. **Cannot conclude pass or failure.** |
| 14 | Freeze historical comparison baseline | Aggregate manifest committed. Event-level source data not available in repository; no real-data replay. |
| 15 | Define integrity checks for event ledger | Implemented `validateLedger` in research-only pure module. |
| 16 | Detect same-stock overlapping outcome windows | Implemented `overlapFlags` as descriptive flag; does not drop observations or estimate independent uncertainty. |
| 17 | Compare cohort-level old vs next-open metrics | Implemented `compareCohortSummaries`; rejects mismatched cohorts/event counts. |
| 18 | Add synthetic regression coverage | Eight new unit tests; **not yet verified passing on GitHub Actions**. |
| 19 | Extend CI test scope | Updated workflow to include all five test files, **46 declared tests** (11+13+8+6+8). |
| 20 | Gate further integration | This review specifies required proof and blockers below. |

## Evidence and blockers

- The 20-stock historical totals were collected from prior manual probe results: 24 first events, 15 matured 5-session, 11 positive, 4 negative, 9 pending, 8035 excluded. They have **not** been recalculated with the new strict normalizer or ledger.
- Workflow-run query is restricted to PR-triggered runs and returned none. Do not interpret that as the push workflow not running. GitHub Actions UI or a broader run listing must be inspected.
- `AdjFactor` provider field completeness and semantics need validation against the licensed source before strict normalization is wired into the existing endpoint.
- The 46 tests are **defined**, not evidenced passing in CI.
- The synthetic suite does not establish that the detector predicts price increases or that next-open fills are achievable.

## Required acceptance before next milestone

1. Obtain an actual CI run URL and job conclusion for the current research branch and resolve failures.
2. Review provider schema and data rights, and manually inspect duplicate and adjustment-factor cases.
3. Reproduce all 24 historical first events from immutable event-level source rows; reconcile missing/excluded counts explicitly.
4. Compare per-event and per-cohort old vs new returns, with 1/3/5/10-session horizons and coverage denominators.
5. Introduce transaction cost assumptions and overlap embargo; distinguish descriptive results from out-of-time testing.
6. Only then consider an owner-only Preview endpoint behind a flag. Require separate approval for any production deployment, database write, notification, automated provider collection, or `main` merge.

## Code inventory

- `app/lib/research/dualSurgeDetectors.mjs` — existing detector
- `app/lib/research/dualSurgeEvaluation.mjs` — pure evaluation helpers
- `app/lib/research/dualSurgeLedger.mjs` — event ledger and cohort summary
- `app/lib/research/dualSurgeComparison.mjs` — strict manual provider normalization and side-by-side comparison
- `app/lib/research/dualSurgeQualityGates.mjs` — event validation, overlap flags and cohort comparison
- `tests/research/dualSurge*.test.mjs` — five test files, 46 declared test cases
- `.github/workflows/dual-surge-research-tests.yml` — research branch CI configuration

**No success claim** is made for CI or real-market replay.
