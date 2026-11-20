# Crash resilience V2 — isolated research plan (2026-11-20)

Status: RESEARCH ONLY. No production deployment, notification, order execution, or changes to existing frozen cohorts.

## Existing foundations reviewed
- `app/lib/research/crashStrengthShadow.mjs` already compares saved daily stock prices to TOPIX (fallback Nikkei), requires 800–1500 stocks per saved day, and computes 1/3/5-session outcomes.
- `app/admin/crash-strength/forward/page.tsx` displays previously frozen crash cohorts and separately labeled retrospective evidence.
- `app/api/market/route.ts` already exposes a TOPIX market symbol.
- Existing forward evidence must never be relabeled as live predictions.

## Research protocol
1. Freeze crash day only after actual exchange close and valid market reference; use TOPIX <= -2% as a NEW V2 definition, never silently reinterpret V1's Nikkei criterion.
2. Save date, benchmark, source timestamp, eligible universe, raw price and coverage; mark absent data missing.
3. Define resistance groups: positive stock day return; or stock return - TOPIX return >= 3 percentage points. Also preserve continuous relative-strength ranking.
4. Track distinct market events, not just stocks; separate historical backtests from forward cohorts.
5. Measure close-to-close outcomes at 1/3/5/10 exchange sessions with actual exchange calendar; no future information in ranking.
6. Compare entry at next-session 09:20, 11:20, 14:15 only when trustworthy minute bars exist. These are hypothetical reference prices, not assured executable fills. Capture timestamps, spread, fees and slippage assumptions separately.
7. Record sample count, distinct crash days, average, median, win rate, TOPIX excess return, worst drawdown and missing-data counts.
8. Compare against all eligible stocks and a liquidity-matched control cohort; stratify by sector and market regime.
9. Reject survivorship/look-ahead bias, adjusted/unadjusted price mixing, stale prices and invalid stock splits.
10. Require separate tests, manual review and explicit approval before any merge/deployment or user-facing signals.

## Next engineering work
- Extend the pure read-only calculation to 10-session returns, maintaining backwards compatibility.
- Add deterministic tests for holidays, missing sessions, outliers, price adjustment and as-of boundaries.
- Audit actual database coverage and data-source access before promising intraday results.
- Add a separate owner-only V2 research view, without altering existing V1 or live rankings.

## Current limitations
No V2 results have been computed. No 2026-11-20 cohort has been frozen by this document. No claim of statistical significance or predictive power is made.
