# Crash resilience V2: data-quality audit (2026-11-20)

Status: RESEARCH ONLY / NOT TRADE-READY. Read-only queries against signal-x Supabase; no database writes or deployment.

## Coverage
- public.daily_stock_results: 92 distinct dates from 2026-06-29 to 2026-11-20; 953 distinct codes on 2026-11-20.
- signal-x-dev did not have the four queried public tables; data below was found in signal-x production database, read-only.
- Existing crash_forward_events: 2026-10-22, 2026-10-30, 2026-11-06, 2026-11-16. These V1 events use Nikkei criteria and MUST NOT be relabeled TOPIX V2.

## Historical V1 RESISTANCE 20 candidates per event
Reference = event-date saved close, not executable next-day entry. Stored daily prices were matched by trading-date sequence, 1/3/5/10 sessions. This is retrospective MARK-TO-MARKET ONLY.
- 2026-10-22: day3 +0.934%; day5 -4.832%; day10 -14.908%
- 2026-10-30: day3 +7.935%; day5 +5.843%; day10 +7.997%
- 2026-11-06: day3 +5.968%; day5 +5.158%; day10 -1.334%
- 2026-11-16: day3 -2.483%; day5 and day10 NOT YET OBSERVABLE.
Each observed row has 20 matched daily close records, but this alone does not validate corporate-action adjustments or price quality.

## Outlier inspection (2026-10-22 -> 2026-11-06)
- 3909 Showcase 875 -> 541 (-38.17%), intermediate daily series includes 792,939,1103,897,823,707,630,665,595.
- 3788 GMO GlobalSign 2810 -> 1751 (-37.69%).
- 4493 Cyber Security Cloud 3865 -> 2492 (-35.52%).
- 3132 Macnica HD 4172 -> 2848.5 (-31.72%).
- All 20 RESISTANCE signal_close prices for 2026-10-22 matched daily_stock_results.price for the same date exactly.
- Repeated moves in saved data are NOT independent verification. Need corporate action, raw vendor price, adjustment factor, ticker identity and source timestamp checks.

## Blocking limitations
1. Current daily-close event price cannot be used as an executable entry when selection happens after the close. Next-day entries must be evaluated separately.
2. No usable 5-minute OHLC public table was found by table name search in the inspected production public schema; minute evidence may be held elsewhere and is not yet linked.
3. 2026-11-20 has daily_stock_results records but no observed V1 crash_forward_event in the inspected four-event table at the time of review.
4. Four event dates are far too few for a reliable production signal; stocks within an event are correlated and not independent trials.
5. Fees, spreads, slippage, limit-up/down and fill availability are not incorporated.
6. The new V2 JavaScript tests have been committed but not executed by this audit.

## Required next steps
- Validate adjusted versus unadjusted daily prices against vendor and corporate actions.
- Confirm TOPIX benchmark as-of timestamps, daily completeness and the actual trading calendar.
- Obtain verified next-day 09:20/11:20/14:15 minute bars with source timestamps; do not infer fills.
- Compute event-level and stock-level bootstrap/robustness with untouched forward cohorts.
- Keep V1, V2, and hypothetical entry simulations labeled separately.
