# Stage 6: Bollinger combined-factor historical comparison (READ ONLY)

**No new tables, migrations, price-provider requests, mutation jobs, API POST routes, Cron or automatic learning.**

## Sources and integrity
- Reuse the ORIGINAL frozen outcome rows in bb_breakout_shadow_outcomes (300 total) and bb_breakout_expansion_outcomes (1,124 total), for 1,424 graded observations corresponding to 483 stock+signal-day events.
- Join only signal-time RSI14 / prior 10-day trend / +2σ breakout strength factors already stored in bb_asof_factors (483 rows).
- Read original 20-stock volume only when bb_breakout_volume_factors.original_source_hash matches the originally frozen horizon-1 outcome fingerprint. Read 80-stock volume from original expansion outcome records, where it was captured at the same time.
- Require row counts, one signal/horizon uniqueness, original horizon-1 coverage, as-of factor coverage and expected categories. If mismatched, return an error rather than misleading partial win rates.
- Use one REPEATABLE READ READ ONLY transaction per page request with a hard 6,000-row cap. No asynchronous data collection.

## Predefined historical combinations
- Same upper-breakout baseline (no extra conditions).
- RSI >=70 and volume >=1.3 times prior 20-day average.
- RSI 50 to less than 70 and volume >=1.3.
- Prior 10-session gain 0 to less than +5% and volume <1.3.
- Prior 10-session gain >=+5% and volume >=1.3.
- Close at least +2% above the previous completed +2sigma band and volume >=1.3.
- RSI >=70 and prior 10-session gain 0 to less than +5%.

Display each rule separately for squeeze and non-squeeze signals, for +1/+3/+5 trading-session outcomes. No automatic "best performing" recommendations or trading rules.

## Chronological historical split
- Early: signal dates before 2026-09-01.
- Embargo: signal dates 2026-09-01 through 2026-09-07, withheld in both comparisons. Approximate 5 trading-session embargo to avoid nearby signal outcome overlap.
- Later: 2026-09-08 onwards, through currently archived date.
- Each segment must have >=30 mature outcomes independently or all statistics are hidden. Counts remain visible.
- The original full period was already seen by the researcher and these cutoffs/conditions were selected during development; therefore this is **NOT genuinely held-out out-of-sample validation**. Beware calendar regimes, correlated events, small n, multiple comparisons, fees and execution assumptions. Future independent data remains necessary to validate usefulness.

## Release constraints
- Route GET under /api/admin/bollinger-breakout-shadow/combined owner-only (getLearningOwnerSession) with no-cache.
- Owner-only UI appended to existing /admin/bollinger-breakout-shadow page.
- All offline unit/regression tests, Next type generation, TS check and Vercel preview deployment checks required before merge.
- Only read access to the production database; no DEV access; no changes to live signal, AI POWER, ranking, notifications, paper trading, Cron or archived outcomes.
