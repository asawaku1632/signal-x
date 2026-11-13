# SIGNALX 決算後リターン研究 v1 — 事前固定仕様 (2026-11-13)

Status: RESEARCH ONLY / NOT TRADE ELIGIBLE / NOT PRODUCTION ELIGIBLE.

## Scope
Universe: TSE-listed equities with verifiable timestamped earnings announcements, point-in-time fundamentals and unadjusted/adjusted daily OHLCV; retain delisted names when available. Earnings event must be mapped to the **first trading session after public release** (after-close releases map to next session). Intraday releases are excluded from v1 intraday entry tests unless timestamp and market halt status are verified. Record source, fetched_at, release_at JST, fiscal period, revisions and corporate actions. Do not equate SIGNALX daily_stock_results to earnings fundamentals.

## Frozen classification
Fundamentals: YoY operating-profit growth positive/negative/unknown; reported-vs-consensus beat/miss/unknown (only consensus published before release); forecast revision up/down/unchanged/unknown. Independently label first post-announcement session return positive > +2%, negative < -2%, or neutral; distinguish reaction from fundamentals. Six descriptive scenarios: positive fundamentals + rise/fall/flat and negative fundamentals + rise/fall/rebound; unknowns separately, never forced into a class. Rebound requires first-session return <= -2% and later close > first-session close; cannot be known at entry.

## Outcomes
Event day E = first post-release trading session. Report close-to-close E+1,+2,+3,+5,+10,+20 trading-session returns; separately, simulated entries E 09:20, 11:20, 14:15 and E+2 / E+3 using timestamped minute bars, next executable bar after signal, with spreads/slippage/fees assumptions declared. No minute bar => unavailable, never interpolate from daily. Track positive-return fraction, mean, median, sample size, distinct codes, event count, maximum adverse excursion, worst drawdown, and 100-share P&L within 500,000 JPY notional. Account for stop limits, suspension, splits and missing observations. No outcome measured until fully matured.

## Anti-leakage / validation
All entry filters must use data available by entry timestamp. Split train and out-of-sample chronologically; purge overlapping event windows; group repeated observations by event/company, and report confidence intervals. Include market and sector matched controls. Fix transaction cost assumptions before evaluating. No cherry-picked thresholds or claims of profitability based on exploratory fit.

## Initial case
9468 KADOKAWA: release 2026-11-12 15:30 JST pending verification against primary IR. E=2026-11-13 conditional on exchange calendar. Lock event metadata and price snapshots before observing later outcomes. Do not backfill a post-hoc 'forecast'.

## Gates
1. Verify point-in-time announcement and financial data source and licensing.
2. Audit historical coverage and timestamped OHLCV for 09:20/11:20/14:15.
3. Produce deterministic read-only research output and unit tests for announcement timing, holidays, leakage, splits, missing bars, duplicates.
4. Only after adequate independent forward replication consider separate owner-only shadow UI. No production notification, rankings, brokerage execution or database writes authorized.

This document fixes methodology; it does not claim historical tests or ingestion were executed.
