# Dual Surge — Phase 2 Steps 5–7 (2026-10-24)

## STEP 5 — Research-only adapter
Added `app/lib/research/dualSurgeLedger.mjs`. `buildDualSurgeLedger({code,rows,signals})` accepts already supplied, sorted historical session rows with `date/open/close/adjFactor` and signals with `date/cohort`. It groups consecutive same-cohort events and returns **both** legacy signal-close-to-future-close and next-session-open-to-future-close proxies at 1/3/5/10-session horizons. It does not fetch data, modify the existing API, persist data or change production signals. This is an **isolated integration adapter**, not yet a deployed route connection.

## STEP 6 — Regression coverage
Added `tests/research/dualSurgeLedger.test.mjs` (8 tests): consecutive grouping, distinct entry metrics, per-cohort summary, pending outcome, missing adjustment factor exclusion, duplicate sessions, out-of-order sessions and invalid summary input. Existing detector (11) and evaluation (13) tests remain separate. These tests require execution and CI verification; committing tests alone is not evidence of passing.

Run locally in a checked-out repository:
```sh
node --test tests/research/dualSurgeDetectors.test.mjs tests/research/dualSurgeEvaluation.test.mjs tests/research/dualSurgeLedger.test.mjs
```

## STEP 7 — Safe rollout gate and interpretation
`summarizeLedger` returns cohort-separated matured/pending/excluded counts, positive counts, +5%/+10%/-5% tails, average, and an insufficient-sample flag (<30). These metrics are **descriptive**, not prospective win rates. Next-open return is a gross price proxy, **not** an executable backtest: no slippage, spread, fees, tax, limit-up constraints or order-fill modeling. AdjFactor missing or non-1 is excluded in this research-only adapter, but the existing historical route still uses its legacy rules.

Before wiring to an endpoint:
1. Verify J-Quants AdjFactor type and semantics against licensed documentation; avoid assuming a missing field means no corporate action.
2. Validate synthetic tests in CI and resolve failures; review branch deployment status.
3. Define a deterministic mapping from provider rows to normalized `rows` without silently dropping invalid sessions, duplicate dates, or adjustments.
4. Compare old/new results per event and cohort with explicit exclusions, not a single blended success rate.
5. Add an overlap embargo, market-date clustering and out-of-time testing before inferential confidence claims.
6. Verify data licensing **before** any automated collection or persistent dataset.
7. Keep owner-only, preview-only, no writes, no cron, no notifications and no production merge.

## Change scope
Research branch: `fix/dual-surge-dev-db-isolation-20261023`.
Production app route unchanged; no Supabase writes or data acquisition performed. No claim that the 20-stock baseline has been recalculated using the new adapter.
