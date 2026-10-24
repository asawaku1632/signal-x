# Dual Surge — Steps 31–40 (2026-10-24)

Branch: `fix/dual-surge-dev-db-isolation-20261023`. Research-only, no production route changes.

| Step | Work | Outcome |
|---|---|---|
| 31 | Revisit CI verification | No general Actions-run listing/dispatch available through connected GitHub tools; GitHub Actions pass/fail remains **unverified**. |
| 32 | Confirm real historical replay inputs | Frozen baseline contains only aggregates; 24 individual event records and immutable OHLCV snapshots not present in this work context. **Real replay blocked.** |
| 33 | Define exact reconciliation | Added `reconcileBaseline` comparing event, matured, pending, positive and negative counts; discrepancies are explicit. |
| 34 | Keep pending and excluded separate | Counts tracked separately in reconciliation; no fabricated zero return for pending. |
| 35 | Audit overlapping windows | Added per-stock 5-session overlap report via `overlapFlags`. |
| 36 | Audit 1/3/5/10 session coverage | Added `maturityTable` output to report. |
| 37 | Add explicit release gates | Report always says `approvedForProduction:false`; flags small sample (<30 matured) and overlap. |
| 38 | Add synthetic regression tests | 10 test cases committed for reconciliation, overlap, sample warning, reproducibility and invalid inputs. |
| 39 | Register CI checks | Research workflow extended to **66 declared tests** across seven test files. |
| 40 | Record verification and handoff | This document; code committed, **CI pass and real-data reconciliation not claimed**. |

## Reconciliation reference (not rerun)
The previously observed curated study had 20 selected stocks, 19 detector eligible, 24 first events, 15 matured 5-session results, 11 positive, 4 negative, 9 pending. This is a *frozen aggregate reference*, not an event-level reproducible dataset. Never pass a synthetic ledger as proof of those numbers.

## Changed paths
- `app/lib/research/dualSurgeAuditReport.mjs`
- `tests/research/dualSurgeAuditReport.test.mjs`
- `.github/workflows/dual-surge-research-tests.yml`
- `docs/research/dual-surge-steps31-40-20261024.md`

## Required acceptance next
1. Open GitHub Actions and inspect the **actual** workflow run and conclusion for the research branch; fix test failures if present.
2. Validate provider rights and `AdjFactor` semantics.
3. Supply an authorized, immutable, event-level dataset; reconcile 24 historical events with full stock/date/entry/exit and exclusions.
4. Run event-level audit and compare old vs next-open proxies. Reconcile by cohort and 1/3/5/10-session horizon.
5. Add transaction cost assumptions and overlapping-window sensitivity before interpreting any return distribution.
6. Keep preview-only/owner-only, no-store, no database writes and no automated provider fetch. No production merge without separate approval.

Command for a local checkout:
```sh
node --test tests/research/dualSurgeDetectors.test.mjs tests/research/dualSurgeEvaluation.test.mjs tests/research/dualSurgeLedger.test.mjs tests/research/dualSurgeComparison.test.mjs tests/research/dualSurgeQualityGates.test.mjs tests/research/dualSurgePreflight.test.mjs tests/research/dualSurgeAuditReport.test.mjs
```

**Status:** Steps 31–40 research code/docs complete; CI and real-data evidence still outstanding.
