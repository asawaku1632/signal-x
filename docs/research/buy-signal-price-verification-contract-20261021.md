# Buy-signal recovery: independent price validation contract

Status: research proposal only. No live API integration, credentials, database writes, notifications or trading changes.

## Why the current observations cannot be scored
- The monitor activation reference price is a saved quote/scan reference, not a confirmed executable fill or independently verified adjusted closing price.
- The future daily_stock_results.price is also scan-derived and can reflect an earlier intraday candle.
- Both endpoints of a return must be independently validated on the **same price basis**. A verified future close alone is insufficient.
- Intraday activation price versus future daily close is a different estimand from close-to-close returns. Keep these analyses separate.

## Candidate independent source
JPX/J-Quants v2 /equities/bars/daily provides unadjusted C, adjusted AdjC and corporate-action AdjFactor. It is a candidate **daily closing price** reference, not proof of an intraday activation fill. Subscription entitlement, availability and redistribution rules require review before use.
Documentation: https://jpx-jquants.com/en/spec/eq-bars-daily

## Required evidence for each price
- Stock identifier, TSE session date, source/provider, exact endpoint and field, unadjusted price, adjustment factor, adjusted price and units.
- Retrieval time in UTC, original market/session timestamp when available, source record revision/correction notes, and immutable observation ID.
- Explicit flags for independent source validation and corporate-action comparability. Never infer these flags from non-null price or from an upstream label.
- For activation baselines, preserve the original timestamp and quote provenance. Do not silently substitute that day's official close.
- Track no-trade/null records, missing days, calendar coverage, late corrections and unsupported corporate actions separately.

## Safe staged implementation
1. Obtain provider access/licensing approval and review data retention terms. Do not store secrets in GitHub.
2. Add a read-only, owner-only source comparison for a tiny, fixed historical sample. Preserve all original SIGNALX values.
3. Compare stock/date/price basis, validate split/rights adjustment, and investigate mismatches before granting any verification flag.
4. Only after independent tests and explicit approval, consider separate append-only research evidence storage; no edits to daily_stock_results or favorite_ai_monitors.
5. Require BOTH baseline and target evidence before computing checkpoint returns. Keep all existing observations UNVERIFIED until then.
6. Review survivorship, duplicate-stock dependence, out-of-sample performance and selection bias before showing aggregate rates.

## Out of scope
No automatic trading, no notifications, no recovered/win-rate claims, no retrospective rewriting of historical signals, and no deployment to production from this research branch.
