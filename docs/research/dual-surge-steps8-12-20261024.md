# Dual Surge — Steps 8–12 implementation log (2026-10-24)

Branch: `fix/dual-surge-dev-db-isolation-20261023`. All changes isolated to research code/tests/docs/CI.

## Step 8 — Full CI suite coverage
Updated `.github/workflows/dual-surge-research-tests.yml` to run detector (11), evaluation (13), ledger (8), and comparison (6) unit tests, **38 defined tests total**. CI status/pass count has not been verified; the workflow was previously limited to detector tests. Node command:
```sh
node --test tests/research/dualSurgeDetectors.test.mjs tests/research/dualSurgeEvaluation.test.mjs tests/research/dualSurgeLedger.test.mjs tests/research/dualSurgeComparison.test.mjs
```

## Step 9 — Strict provider-row normalization
Added `normalizeResearchRows` in `app/lib/research/dualSurgeComparison.mjs`. It rejects invalid prices, malformed code/date, duplicate dates, and missing/nonpositive adjustment factors rather than silently dropping records. This strict handling is research-only and **may exclude records accepted by the existing probe**.

## Step 10 — Side-by-side legacy / next-open comparison
Added `compareResearchEvents`, a pure, manual-data function that returns an event ledger and separate five-session cohort summaries for signal-close-to-future-close and next-session-open-to-future-close. No provider fetch, no owner-only route change, no database writes.

## Step 11 — Additional tests
Added 6 synthetic tests for sorting, duplicate dates, missing adjustment factor, malformed OHLCV, wrong provider code, and side-by-side comparison. They must pass in CI before treating this adapter as verified.

## Step 12 — Review and rollout gate
- **Not done:** run actual 20-stock dataset through the new adapter; existing 24-event baseline is not recalculated.
- **Not done:** run/verify CI result; deployment verification.
- **Not done:** modify `app/api/admin/dual-surge-history-probe/route.ts` or production routes.
- **Not done:** verify J-Quants data rights for automated research.
- **Not done:** add realistic transaction costs, spread, fills, embargo or walk-forward evaluation.
- Before optional preview-only endpoint integration: review provider adjustment-factor guarantees, resolve CI failures, preserve legacy outputs, label any new metrics as descriptive proxies, and require owner-only/no-store/read-only gating.

The result is a **code-complete research prototype for steps 8–12**, not validated production functionality and not evidence of a profitable trading strategy.
