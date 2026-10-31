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

## All-breakout waiting policy sensitivity (exploratory, 2026-10-31)

New pure in-memory module: `app/lib/research/ma75WaitPolicy.mjs`.
It starts at **every eligible breakout**, waits for the first valid retest within ten later trading sessions, and assigns **0% cash return if none occurs**. For comparison, it requires a fully observed **15-trading-session window** for every breakout and quarantines any >45% close discontinuity anywhere within that window. It excludes immature and quarantined opportunities rather than treating them as failed trades. Slippage remains 0.1% adverse on each executed side, not on cash.

In the same selected 126 stored chart-cache names (SQL read only), **126 fully matured opportunities across 65 stock codes** were available after filtering. Among them, **56 had a retest trade and 70 remained in cash**.

| Policy across all 126 matured breakout opportunities | Average realized 5-session trade return per opportunity | Positive outcome per opportunity |
| --- | ---: | ---: |
| Buy breakout next open | **+0.118%** | 52.38% |
| Wait for first retest; otherwise hold cash at 0% | **+0.773%** | 25.40% |

These are **policy-opportunity outcomes, not comparable conditional trade win rates**: zero-return cash opportunities count as neither positive nor negative, and waiting has substantially less exposure and a later potential exit date. The averages assume equal weights per initial breakout, no idle-cash interest/opportunity cost, no redeployment or capital constraints, and overlapping observations from the same code. Even though waiting has a larger in-sample average here, this does not establish a risk-adjusted or real-world edge. The earlier matched retrospective comparison selected only successful future retest cases and therefore estimates a different quantity.

The 75-day rising-slope, volume>=1.5x, and AI POWER combinations have **not** independently passed promotion. We continue to block any live buy scoring, production alerts and notification activation. Tests for main, chronological and wait-policy modules: 18 focused Node 22 local tests passed; GitHub-wide CI is separately tracked.

## Prospective forward protocol V1 (2026-10-31, research only)

To prevent cherry-picking the previous 126 chart-viewed stocks, separate modules now implement an **optional, explicitly frozen future research cohort**. They do not automatically select securities, subscribe to J-Quants, request data, schedule jobs, create tables, or persist a research result.

- `app/lib/research/ma75ForwardProtocol.mjs`: create a manifest containing the exact chosen securities, selection policy, freeze timestamp, first permitted forward date, source provider and source/corporate-action/timestamp certifications. A content SHA-256 identifies later edits. Explicit source statuses stay BLOCKED unless all three categories are marked VERIFIED; the assertions themselves still require independent documentary verification. This code never claims that self-supplied timestamps are independently trusted. Preserve the actual Git commit timestamp when freezing a real future cohort.
- Predeclared variants: ALL breakout, SMA75 rising, prior 20-session volume >=1.5x, slope plus volume, and first retest or cash. Source must not be retrospectively replaced by viewed-chart samples.
- `auditMa75ForwardEvidence` rejects unlisted securities, duplicate code/date, before-freeze dates, mismatched provider, invalid close-crossing factors, and data captured or classified after the claimed next open. Trading-calendar correctness and actual original bar availability remain unverified gates.
- `app/lib/research/ma75ForwardReplay.mjs`: recomputes SMA75 and volume ratio from at least 76 supplied **completed** daily OHLCV candles. Rejects out-of-order/duplicate bars, future bar on a signal date, suspicious >45% one-day discontinuity (split/manual-review), unconfirmed crossover, incorrect provider or late captures. Outcomes remain NOT_YET_OBSERVED, with zero counted forward outcomes and **null** win rate, never a fabricated 0% or optimistic figure.
- Twelve-day-delayed J-Quants history can still be used for **retrospective/offline** research, clearly labelled with the actual observation time, but cannot count as an actionable next-opening forward prediction for the earlier date. To measure genuine forward next-opening decisions, data must have been available before the claimed next entry.

These protocol tests use **synthetic 2026-11-02 examples only**. No live future data, frozen real selection manifest, provider usage-rights approval, company-action adjustment audit or official trading-calendar certification was established. In particular, `VERIFIED` values supplied to the pure function do not establish an independently authenticated provider contract.

Local Node 22 regression run:
`node --test tests/ma75*.test.mjs`
**30 tests / 30 passed / 0 failures** across breakout/retest, chronological, wait-policy, source provenance and daily-bar as-of replay modules. Repository-wide CI and Vercel checks are tracked separately; local tests do not establish model predictive accuracy.

Promotion gate remains BLOCKED: no merge, AI POWER updates, trade recommendations, notifications, production database writes, new subscriptions, or automatic tasks. This module is an offline research interface only. Actual future research must record immutable data provenance, freeze an independently chosen cohort *before* observations, measure all opportunities including no-retest/cash, and validate risk, transaction costs and independent holdout periods.
