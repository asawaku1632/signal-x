# SIGNALX Dual-Surge Phase 2 — Static Code Audit (2026-10-24)

Scope: `app/lib/research/dualSurgeDetectors.mjs` and `app/api/admin/dual-surge-history-probe/route.ts` on research branch `fix/dual-surge-dev-db-isolation-20261023`. Read-only inspection; **no runtime tests or data writes performed**.

## Confirmed correct in current implementation

1. Detector requires `asOfIndex >= 21`, slices current bar plus previous 20, and computes `high20` from the **previous 20 bars only**. Volume baseline also uses previous 20. Thus it does not use future bars in its signal feature calculation. Signals rely on current day's completed OHLCV, so they are **close-known**, not pre-close actionable.
2. OHLCV positive/range checks and strictly increasing bar timestamps are present in the detector. API additionally parses/validates provider rows and sorts by date.
3. The route gates owner session, Preview environment and explicit feature flag; no database writes or scheduled jobs in these files.
4. For each stock, the route groups *immediately consecutive trading-session signals in the same cohort* into one event. It preserves continuation-day signals separately for diagnostic analysis.
5. Forward returns use future closes only for historical labels, and report `null`/pending when insufficient future sessions. Future corporate-action factors, when detected, invalidate those labels.
6. Feature buckets flag fewer than 30 matured five-session events as insufficient sample. `continuationStudy` explicitly warns that consecutive-day classification is only known retrospectively.

## Risks / limitations to address before expanding inference

### P1 — Entry/exit realism
`forward.signals` calculates `future.close / signal.close - 1`. This is diagnostic, **not** a backtest assuming an achievable entry after seeing the completed signal bar. Define next-open entry and execution costs separately. Do not replace historical diagnostic numbers silently.

### P1 — Corporate-action factor missingness
`convert` sets `split` only when `typeof row.AdjFactor === "number" && row.AdjFactor !== 1`. A missing, nonnumeric, or malformed `AdjFactor` currently behaves as `split:false`, rather than quarantining the row. Verify provider field guarantees and design fail-closed handling. Note: not every corporate action can be inferred solely from one factor field.

### P1 — Nonindependent overlapping windows
Consecutive-session grouping reduces duplicate counting, but nonconsecutive events within 5 or 10 sessions may have overlapping outcome windows, and same-market-date events across stocks may be correlated. Define embargo / event clustering before estimating uncertainty or win rates.

### P2 — Data integrity / completeness
Route de-duplicates same-date rows by taking the first after sorting, without explicitly rejecting conflicting duplicates. `complete` checks last date and 22 sessions but does not establish whether there are missing expected exchange sessions. Timestamp monotonicity alone does not establish session-calendar continuity. Establish a trading calendar / provider data quality checks.

### P2 — Corporate-action quarantine semantics
`corporateActionInWindow` describes the last 22 rows, whereas historical signals may have a different eligibility window. The API reports `recordsReceived`, `validOHLCV`, and `unavailableSessions`, which should be used separately; never count excluded 8035 as an ordinary no-signal observation.

### P2 — Same-cohort event grouping and transition
The event grouping examines adjacent signal entries and matches exact trading-session index; cohort switches break grouping. Define transitions as a **separate sequential state machine** without using future transitions to label entry-day features.

### P2 — Baseline labels and risk thresholds
Current API exposes 1/3/5/10 close-to-close returns and exploratory feature buckets but not primary next-open net returns, >=+5%, >=+10%, <=-5% event rates or confidence intervals. Add research-only diagnostics after test cases and sample eligibility are settled.

## Recommended next tasks (not yet implemented)

1. Add deterministic synthetic fixture tests for previous-20-high boundary, missing/non-numeric adjustment factor, consecutive vs separated events, incomplete horizons, conflicting duplicates and split-crossing outcomes.
2. Specify event ledger schema, outcome embargo, and data quality states: ELIGIBLE, PENDING, EXCLUDED_CORPORATE_ACTION, EXCLUDED_MISSING_DATA.
3. Design separate next-open-to-future-close proxy and costs, retaining legacy close-to-close series for comparability.
4. Only after test coverage and authorization, consider research-only API enhancements; no production changes, persistence, automation or main-branch merge.

## Audit confidence

Static source inspection only. No executed tests, provider schema verification, deployed endpoint verification, or production behavioral claims. Existing historical 20-stock results remain exploratory and selected, not prospective estimates.
