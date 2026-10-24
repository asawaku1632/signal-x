# Low-rating 10-trading-day recovery study (research only)

## Hypothesis
A low initial swing assessment (WATCH / SKIP) may precede a recovery by trading day 10. Do not interpret cross-sectional averages at different horizons as within-symbol recovery.

## Frozen cohort
- Use pre-existing timestamped assessments only, grouped by `(symbol, assessment trading date, assessment timestamp)`; never backfill a signal using later prices.
- Include WATCH and SKIP; compare CANDIDATE and WAIT as controls on the same assessment dates.
- Track the *same* assessment instance through trading days 1, 3, 5, and 10; do not replace missing observations with other symbols.
- Use independently licensed, verified, timestamped adjusted prices; exclude unavailable or invalid price histories with explicit reasons. Respect splits, delistings, suspensions, and trading calendars.

## Metrics
- At each horizon: eligible cohort size, observed count, missing count, mean/median return, positive-return share, >=3% gain, <=-3% loss, and distribution quantiles.
- At day 10: paired trajectories for only fully observed 1/3/5/10-day cases; separate estimates for all eligible 10-day observations.
- Recovery: initial negative return followed by day-10 positive return; distinguish this from always-positive trajectories. Report first recovery day when observed.
- Intraperiod maximum drawdown and recovery from trough require reliable daily low observations; close-only drawdown must be labeled separately. Do not call the worst endpoint return maximum drawdown.
- Analyze assessment transitions WATCH/SKIP -> WAIT/CANDIDATE using only information available by each transition date, and measure returns from the *transition-time* entry reference separately.
- Stratify by AI POWER band, market regime, volatility, volume, sector, and assessment date where sample sizes allow.

## Quality gates
- Avoid survivor bias and overlapping observations inflating independence; report both event count and unique symbols/dates.
- Compare against same-date market and baseline cohorts; report uncertainty and date-level sample coverage.
- Show `insufficient evidence` for immature horizons (currently day 10 may represent only one assessment date); never claim a proven strategy or guaranteed recovery.
- No changes to production trading signals, notifications, cron, or database writes. Read-only feasibility first; any implementation needs verified source and isolated development tests.

## Acceptance tests for future implementation
1. A symbol missing day 5 remains missing; it is not silently replaced.
2. One date with many symbols cannot be presented as many independent market days.
3. Split-adjusted series does not create false +100%/-50% moves.
4. WATCH -> CANDIDATE transition never uses future values.
5. UI distinguishes mean of changing samples from paired same-cohort trajectory.
6. No user-facing win-rate language for unverified or immature cohorts.
