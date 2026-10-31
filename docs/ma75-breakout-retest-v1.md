# SMA75 breakout vs support retest (shadow research V1)

As of 2026-10-31 JST. Pure offline research; no application scoring, scheduled job, database writes, notifications or production deployment.

## Rules

This study measures **SMA75** (simple arithmetic average of 75 daily closes), which is distinct from SIGNALX's existing EMA75.

- A breakout signal occurs after daily close i if close[i] > SMA75[i] and close[i-1] <= SMA75[i-1].
- A retest signal is the first trading day during the subsequent 10 sessions where low <= SMA75*1.01, close >= SMA75, and close >= open. A preceding close below SMA75 after the breakout invalidates the retest setup.
- Hypothetical buy at next trading day's open, worsened by 0.1%. Exit at the signal+3 and signal+5 daily closes, worsened by 0.1%. Entries and exits are not actual fills.
- Track volume relative to the prior 20 sessions, SMA75 slope, minimum future 5-session low, per-100-share P&L, and budget subgroup of 100,000 to 500,000 JPY for 100 shares.
- Incomplete outcomes stay pending, not wins/losses. Duplicated, out-of-order, invalid or less-than-76-bar cohorts are excluded. Any one-session close move exceeding 45% quarantines the affected as-of signal or outcome window for corporate-action review. A future gap does **not** delete valid prior signals. Quarantined outcomes and pending outcomes are reported separately.
- Produce both all-signal descriptive statistics and a paired analysis of the same original breakout with its eventual first retest. **The paired condition uses future knowledge and is NOT a prospective trading rule.**

## Read-only exploratory audit of existing SIGNALX data

Source: production chart cache, public.display_snapshots, key format chart:CODE:1D, daily candles from payload, payload.dataSource = yahoo_chart. Read only, no raw bar export, as of 2026-10-31 JST.

- 126 selected chart snapshots, each with 121 to 123 daily candles.
- Separate daily_stock_results data spans 78 distinct dates for 967 codes. It is not a substitute for OHLCV with sufficient prior-history warmup.
- The chart cache is selected by *which stocks were viewed*, not a frozen representative exchange-wide universe. As-of raw source, usage license and corporate-action adjustment must be independently validated.
- The original exploratory SQL excluded an entire cached stock on a >45% single-day move; the independent research engine applies a stricter time-local quarantine so future gaps cannot change past signal eligibility. Results should be recomputed from a frozen licensed source before any promotion.

| Exploratory metric | Immediate breakout | First retest |
| --- | ---: | ---: |
| Observed signals (including pending) | 185 | 86 |
| Completed 5-session outcomes | 165 | 70 |
| Codes with signals | 79 | 56 |
| Mean after 0.1% adverse price each side | +0.256% | +1.677% |
| Positive returns | 53.94% | 58.57% |
| Complete outcomes with 100-share entry of 100k to 500k JPY | 109 | 47 |

These are **different non-random samples**. A larger average does not prove better strategy performance.

Paired descriptive analysis: 70 matched signals from 49 codes, selected *because a later retest actually happened*. Five-session returns were +2.129% for the breakout and +1.677% for the retest. Positive rates were 68.57% versus 58.57%. The retest beat its paired breakout return in 35.71% of pairs. This result is also not causal or prospectively tradable: conditioning on future retest occurrence can bias the result.

Note: overlapping same-stock trades are correlated; no valid significance claim is made. Brokerage fees, tax, actual execution, dividends, complete split adjustment, and market impact are excluded.

## Promotion requirements

1. Freeze a broad eligible stock universe and approved provider-source, with verified OHLCV timestamps, adjusted splits, minimum liquidity and license.
2. Replay signal decisions strictly as-of their completed daily bar. No future indicators or future-retrospective selection. Treat no-retest opportunities as no trades and model idle capital.
3. Compare holdout dates, code/day-clustered confidence intervals, market regimes, TOPIX baseline, equal capital exposure, max adverse excursion and drawdowns, realistic execution/slippage and losses.
4. Preregister thresholds before holdout; require independent forward validation and adequate sample before connecting to AI POWER, buy recommendations, or push notifications.

Research engine: app/lib/research/ma75BreakoutRetest.mjs
Tests: node --test tests/ma75BreakoutRetest.test.mjs

Originally seven local Node 22 unit tests passed; the primary module now has eight. PR #216 and #292 and production remain unchanged.

## Additional exploratory budget and risk sensitivity (read-only)

For exactly 100 shares with entry cost **including 0.1% adverse next-open execution** in ¥100,000–¥500,000:

| Candidate group | Complete N | Mean 5-session return | Positive rate |
| --- | ---: | ---: | ---: |
| Breakout, budget eligible | 109 | +0.347% | 55.05% |
| Retest, budget eligible | 47 | +1.740% | 59.57% |
| Breakout, budget eligible and SMA75 rising | 74 | +0.655% | 56.76% |
| Retest, budget eligible and SMA75 rising | 33 | +2.195% | 63.64% |

These were defined post hoc and **must not be interpreted as validated optimal filters**. The last row's worst five-session close-to-close return was -6.716%, despite its positive mean. Across *all* completed signals (not budget-restricted), worst five-session returns were **-17.270%** (breakout) and **-11.013%** (retest). Mean five-day minimum-low adverse excursion for the overall groups was about -3.785% and -2.938%, respectively. These are not maximum drawdowns or guaranteed stops.

Confirmed signal events in the available sample were concentrated from **2026-08-04 to 2026-10-15**, too short and too selected to demonstrate cross-regime reproducibility. Both candidates can lose significantly. Any future screening on this subgroup must be tested on holdout / frozen forward data not used to select the subgroup.

Local Node.js 22 focused regression check: **8 of 8 tests passed**, including a future-gap lookahead regression. Repo-wide GitHub Actions suite has not been confirmed.

## Chronological slope-volume exploratory audit (read-only; 2026-10-31)

Additional pure research module: `app/lib/research/ma75ChronologicalAudit.mjs`.
Tests: `node --test tests/ma75BreakoutRetest.test.mjs tests/ma75ChronologicalAudit.test.mjs`.
The secondary module accepts frozen study observations, slices by a supplied **calendar cutoff**, and calculates ALL, SMA75_RISING, VOLUME_1_5, BOTH in EARLY/LATE periods. It returns pending, quarantined, observed, distinct-code and budget subgroup counts. Its eligibleForProduction field is always false.

The following read-only SQL sensitivity was run using the *same 126 viewed-candle snapshots* and a cutoff of **2026-09-25** selected **after** earlier aggregate results had been inspected. This is a chronological **post-hoc sensitivity**, explicitly **not an independent or prospective holdout**. Rows represent signals with five-session outcomes, not non-overlapping independent trades.

| Period (signal date) | Strategy | SMA75 rising: N, 5-session average, positive | Not rising: N, average, positive |
| --- | --- | --- | --- |
| Before 2026-09-25 | Breakout | 82, about +0.322%, about 51.22% | 51, about +0.196%, about 56.86% |
| 2026-09-25 onward | Breakout | 16, about +1.762%, 75.00% | 16, about -1.397%, 37.50% |
| Before 2026-09-25 | Retest | 33, about +3.044%, about 66.67% | 22, about -0.009%, about 45.45% |
| 2026-09-25 onward | Retest | 10, about +0.793%, 60.00% | 5, about +1.836%, 60.00% |

Within the already selected stock universe, breakout SMA75 slope is associated with better returns in the later section, but not clearly in the earlier section. Retest slope also changes ranking across periods. **No stable independently confirmed edge has been found.** Volume >=1.5x contains too few retest observations for a defensible performance claim (early rising+volume 1; late rising+volume 1). No parameters may be optimized on these cells and then called independently tested on the same data.

**AI POWER audit:** `ai_judgment_fixed_cohort_observations` has 287 observations across 52 codes and 12 dates (2026-10-15 to 2026-10-30), but joining the 185 SMA75 initial breakout events against the *same code, same signal trade date, 15:15 JST record with quote/snapshot/record-creation timestamp no later than 15:30 JST* resulted in **zero usable AI POWER values**. Therefore SMA75+AI POWER 90 combined win rates are **not measurable** from this cohort; missing values must remain missing. A later-created daily_stock_results score must not be substituted for a historically available, source-audited AI POWER.

Implementation of strict score provenance is descriptive and **does not certify** the provider, raw daily-bar archival availability, split adjustment or historical real-world data-capture timing. Frozen preselected, source-verified future observations, sufficient cross-regime spans, trading-calendar/corporate-action audits, non-overlapping policy comparisons and independent risk evaluation remain mandatory before promotion.

Added five more secondary-module test cases to the eight existing primary regression tests, for 13 focused tests total; local Node 22 execution passed. No live cron, PUSH, AI POWER, DB write, merge or production changes. PR #216 and PR #292 remain untouched.
