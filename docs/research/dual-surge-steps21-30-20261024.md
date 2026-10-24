# Dual Surge — Steps 21–30 (2026-10-24)

Research branch: `fix/dual-surge-dev-db-isolation-20261023`.

| Step | Deliverable | Status |
|---|---|---|
| 21 | Check CI evidence from GitHub | PR-filtered workflow-run lookup showed no runs; **pass/fail remains unknown** |
| 22 | Audit legacy historical API against strict new comparison | Reviewed `app/api/admin/dual-surge-history-probe/route.ts`; legacy drops invalid OHLCV and deduplicates dates, unlike strict adapter |
| 23 | Provider-row preflight | Added `inspectProviderRows` with error-category counts and strict comparison eligibility |
| 24 | Sample coverage report | Added `studyCoverage` to expose eligible/excluded stock denominators |
| 25 | Maturity coverage table | Added `maturityTable` with separate pending/excluded/matured denominators for each cohort and horizon |
| 26 | Provider-code validation fix | Tightened comparison normalizer to require exact four-digit code or its five-digit zero suffix |
| 27 | Regression cases | Added 10 synthetic tests for preflight and coverage |
| 28 | CI suite registration | Extended research-only workflow to include sixth test file: **56 declared tests total** |
| 29 | Release blockers | Listed below; no approval for live API, provider automation or production |
| 30 | Research handoff | This document records code paths, test command and next acceptance gate |

## Critical comparison limitations

- The existing probe's historical results were generated under **different row acceptance and duplicate handling rules**. New strict normalization can reduce or alter the eligible population. Never attribute all differences to the choice of entry price.
- Legacy route treats `AdjFactor` as a split only when it is numeric and not 1; missing values are not automatically excluded. Strict adapter fails closed for missing or invalid `AdjFactor`. Confirm provider schema/rights before mapping or interpreting the difference.
- The frozen 20-stock aggregate (24 first events, 15 matured at five sessions, 11 positive, 4 negative, 9 pending) is **not** an event-level source. No per-event reconciliation or real-data rerun has been completed.
- The new preflight is **read-only and caller-supplied**. It does not fetch from J-Quants, connect to the Next.js route, save to Supabase or change user-visible signals.
- Overlapping windows and selection effects make naïve statistical confidence claims unsafe; cost/slippage/order fills are not modeled.

## Verification command
```sh
node --test tests/research/dualSurgeDetectors.test.mjs tests/research/dualSurgeEvaluation.test.mjs tests/research/dualSurgeLedger.test.mjs tests/research/dualSurgeComparison.test.mjs tests/research/dualSurgeQualityGates.test.mjs tests/research/dualSurgePreflight.test.mjs
```
**56 tests are defined, not verified passing.** Obtain a GitHub Actions job URL and result or execute the checked-out repository's exact source before reporting pass counts.

## Next acceptance gate

1. Confirm CI run status and fix any failures on research branch.
2. Validate `AdjFactor` semantics and licensing against provider documentation.
3. Obtain authorized, immutable event-level historical data for the original 20 stocks.
4. Reconcile exclusions/duplicates and 24 historical events before comparing outcomes.
5. Compute cohort-separated 1/3/5/10-session returns, pending/excluded denominators, overlap sensitivity, and cost-adjusted proxies.
6. Require explicit authorization before any `main` merge, live deployment, automated data collection, database writes or notifications.

## Changes made

- `app/lib/research/dualSurgePreflight.mjs` — new
- `tests/research/dualSurgePreflight.test.mjs` — new
- `app/lib/research/dualSurgeComparison.mjs` — stricter provider-code/date checks
- `.github/workflows/dual-surge-research-tests.yml` — six-file test command
- `docs/research/dual-surge-steps21-30-20261024.md` — this handoff

No change to production behavior.
