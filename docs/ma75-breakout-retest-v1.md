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

## Forward outcome settlement with five exchange sessions (2026-10-31)

Pure research module: \`app/lib/research/ma75ForwardOutcome.mjs\`. Tests: \`tests/ma75ForwardOutcome.test.mjs\`.

Inputs are the frozen cohort manifest, an already classified *as-of* daily-candle replay, a provided ordered exchange-session calendar, and outcome batches with captured/received timestamps. **No provider API is called, no database is written, and no cron/notification is enabled.**

Settlement policy:
- Only the five **exchange sessions after a completed signal date** count; weekends and holidays must be absent from the **externally certified calendar**. These sample calendar dates are not an independent exchange-calendar certificate.
- Hypothetical entry is the next exchange session OPEN with 0.1% price disadvantage, exit is session+5 CLOSE with 0.1% disadvantage. A separate session+3 return is shown. Include 100-share profit/loss, percent return, five-session minimum-low adverse excursion (not an executable stop-loss), and 100,000–500,000 JPY budget eligibility.
- \`PENDING_CALENDAR_SIGNAL\`, \`PENDING_CALENDAR_HORIZON\`, \`PENDING_DATA\`, and \`PENDING_MISSING_BARS\` must **never count as a loss, a win or zero percent return**. No historical/forward outcome is considered validated merely because these examples exist.
- \`QUARANTINED_*\` covers duplicate candidate IDs or batch IDs, out-of-cohort attempts, invalid signal timestamps, provider mismatch, unknown/duplicate sessions, invalid OHLCV, missing/late provenance, and suspicious 45% corporate-action gaps. No quarantine is silently counted in win rates.
- A SHA-256 evidence digest on a completed hypothetical result enables reproducible comparison of source inputs but **does not authenticate the data source or certify that the bars were available at the claimed timestamp**.
- \`validatedForwardWinRate=null\`, \`validatedForwardOutcomes=0\`, and \`eligibleForProduction=false\` remain hardcoded. Descriptive mean/win percentages are labelled hypothetical. Any real promotion requires externally audited rights, calendar, raw-source, source captures, split-adjusted data and independent forward sample.

Added ten explicit new scenario-based unit tests, including synthetic Japanese holiday skipping; no source-verified post-freeze observations were supplied. The *newly committed* test suite is **not confirmed to have executed** in this turn; earlier tests and previous local successes must not be conflated with latest commit CI. Confirm by running:

\`\`\`bash
node --test tests/ma75*.test.mjs
\`\`\`

This is an offline, draft-only addition to PR #297; no production release, automatic finance recommendation, server scheduling, schema migration, new paid provider tier or changes to PR #216 / #292.

## Outcome immutability and descriptive forward dashboard (2026-10-31)

Additional **offline, shadow-only** modules:

- \`app/lib/research/ma75SettlementRevisions.mjs\`: compare two successive hypothetical settlement snapshots under the **same frozen manifest hash**. Allow previously pending candidates to mature; flag disappeared candidates, duplicate IDs, invalid totals, a changed already-completed return/evidence digest, silent quarantine removal, pending-to-quarantine requiring manual review, and newly introduced historical COMPLETED results lacking a prior captured record. It does **not** certify the source of a timestamp or actual market activity. No overwrite or persistence exists in this module.
- \`app/lib/research/ma75ForwardAuditSummary.mjs\`: show completed, pending and quarantined counts for each frozen breakout variant (all, rising SMA75, >=1.5x volume, both), with **hypothetical only** mean, median, positive-rate and worst five-session returns. Zero completed results have null returns/rates; quarantined or pending cases are never silently relabelled winners/losers. Reconcile every candidate ID with every outcome ID and reject count discrepancies. When a revision audit is supplied, a failed transition blocks the integrity assessment.
- The fifth preregistered variant \`WAIT_FOR_RETEST_OR_CASH\` is returned as **unsupported** because breakout-only settlement cannot calculate the true opportunity-level policy outcome; all first-breakout opportunities (including never-retested and cash held) need a separate prospectively captured 15-session ledger.

Verification:
- New revision module: **10/10 local Node.js tests passed** on its current research logic, including completed-history injection rejection. Earlier 30 base tests and a separate local outcome fixture suite (13 cases) also passed. These local checkouts are not a full assertion that every file exactly matches the current GitHub head.
- New summary module: **5/5 functional tests passed** using code fetched directly from GitHub, in a V8 harness with a deterministic hash stub. This is **not** equivalent to an independent Node.js CI workflow or complete repository build.
- GitHub-wide CI and Vercel final statuses must be checked separately. Do not count these examples as new real market observations.

**All live gates remain BLOCKED**: no verified prospective trades, no source/official-calendar certification, no new premium contract, no database writes, no deployment to production, no AI POWER scoring changes, no notifications and no change to unrelated PR #216 or #292.

## Fifteen-session prospective wait-or-cash audit (2026-10-31)

The **shadow-only** module \`app/lib/research/ma75ForwardWaitPolicy.mjs\` fills a research coverage gap that a breakout-only result cannot resolve: evaluate **every** previously captured and frozen SMA75 breakout under two policies, using the *same original breakout cohort*:

1. **Immediate:** buy next exchange-session open and hypothetically sell at the fifth session's close, with 0.1% adverse price adjustment per executed side.
2. **Wait:** within the next ten exchange sessions, buy only after the first daily SMA75-support retest satisfying low <= 101% of contemporaneous SMA75, close >= SMA75 and close >= open, without an earlier daily close below SMA75. Buy the next session's open and exit after five sessions from the retest close; if no qualifying retest occurs, **cash with 0% return for that opportunity**. Waiting or invalidation must not disappear from the denominator.

Full evaluation needs **15 completed sessions after the frozen original breakout** (ten-day wait window plus five-day outcome); shorter windows and missing bars are marked **PENDING**, not losers or cash. Recompute each daily SMA75 from an unmodified history with at least 76 prior completed daily candles and the subsequently collected 15 daily candles. The original same-day close/SMA75 must agree with the historical as-of replay. Strict source, claimed capture times, ordered independently supplied exchange calendar, exact session dates, OHLCV, duplicates and suspicious >45% discontinuity checks quarantine bad samples.

**Critical limitation:** The module does not fetch/store data, independently certify the claimed capture times, prove J-Quants usage rights, check stock splits against a corporate-actions registry, authenticate an exchange calendar, run a cron job, or use actual brokerage fills. It returns **hypothetical** outcomes and always sets \`validatedForwardWinRate=null\`, \`eligibleForProduction=false\`, \`sourceVerifiedIndependently=false\`. Stored chart-view samples and synthetic test fixtures cannot be presented as genuine new forward predictions.

Focused test: \`node --test tests/ma75ForwardWaitPolicy.test.mjs\`: **10 tests passed on Node.js v22**, including a tenth-day retest, a cash/no-retest opportunity, invalidated trend, missing 15-day maturity, duplicate records, malformed/future data and impossible exchange dates. GitHub code and test file byte lengths were checked after commit (7300 and 6141 bytes), but this focused run is **not** a complete checkout/build or GitHub Actions CI pass.

**Next promotion criteria:** freeze a broad liquidity-filtered population *before observing forward results*, capture day-close features with independent source timestamps, observe all 15-session futures, include all cash/no-retest opportunities, use a distinct chronological holdout and meaningful downside risk analysis, review source rights and splits, and only then discuss whether a feature should advance into scoring. No live activation or permission to merge follows from the test pass.

## Independent-review-only promotion gate (2026-10-31)

Research-only module: \`app/lib/research/ma75ResearchReviewGate.mjs\`. Dedicated test file: \`tests/ma75ResearchReviewGate.test.mjs\` (nine tests verified via the fetched GitHub source in a V8 function runner; this uses a deterministic crypto shim, **not** Node.js CI).

This consolidates existing read-only evidence at the same manifest hash:

- Full universe \`ma75UniverseCoverage\` must be structurally complete with **100% observed stock-days**, including **NO_CROSS** records. Missing or quarantined stock-days block complete historical coverage. No retrospective chart-view sample can substitute for independent forward selection.
- Forward summary must have full integrity with the *same* frozen manifest and complete structural universe; at least **100** completed hypothetical breakout +5 session results.
- Forward wait-or-cash policy must have at least **100** completed 15-session opportunities (including no-trade cash results), at least **40** different stock codes, **30** distinct signal dates across **3** calendar months, and at least **10 each** cash opportunities and actually traded retests. No duplicated completed stock/date keys, missing outcome, invented winning cash return, or internally inconsistent totals. These review thresholds are **provisional sample-diversity minima, NOT a significance test or proof of profitability**.
- Settlement revision audit must confirm that completed results have not changed and prior cohort members have not silently vanished or appeared as new completed retrospective winners.

The gate produces a blocker list, sample counts, and an optional \`eligibleForHumanIndependentReview\` value. That label is **only a technical precheck**, not authorization. Even if the caller provides synthetic evidence passing every structural test, the following are ALWAYS **false**: independently verified source/provider rights, official calendar, provable original capture, independently validated splits, independently reviewed risk/costs, production eligibility, notification eligibility and AI POWER scoring eligibility. Independently validated forward win rate stays \`null\`.

No connector subscriptions, live jobs, DB migrations, trades, Vercel production deploys, merges or notifications follow from this gate. An independent reviewer must inspect original provider data/rights, timestamp chain, corporate actions, official holidays, real forward collection, costs, loss tails and overlap before a new explicit permission and implementation could ever be considered.

To reproduce locally on Node.js 22 after checking out PR #297:

\`\`\`bash
node --test tests/ma75*.test.mjs
\`\`\`

This is a forward-research governance safeguard, not an efficacy finding. Previous 77 GitHub-source test functions were executed via a V8 harness with a digest shim; nine newly added gate cases likewise passed in the same type of harness. A complete Node/GitHub Actions CI result for the latest PR head has **not** been established by those local functional checks.

## Frozen historical candidate population for forward study (2026-10-31)

An actual **pre-forward candidate freeze** has now been saved as \`docs/ma75-forward-cohort-freeze-20261031.json\` on the research branch. The file records the **953 unique sorted valid security codes** that already appeared on **2026-10-30** in SIGNALX's existing \`daily_stock_results\`. Read-only source-query rules and original freeze timestamp (**2026-10-31T13:43:02.737Z**) are included, and the **first eligible future signal date is 2026-11-02**. These are **pre-frozen candidate symbols only**, not observed future signals or live buy recommendations. The public archive omits private Supabase project identifiers and credentials.

Historical context: there were 967 distinct format-valid codes over the broader June 29–October 30 records, but just 953 on the selected last date. Selection is intentionally fixed **before** any new November outcomes. This prevents later cherry-picking *within this previously recorded population*, but it **does not correct the original app's selection bias, prove current liquidity, cover every TSE listing, or authenticate provider rights/split adjustment/market schedules**. Do not market these 953 as an unbiased liquid full-market sample.

\`app/lib/research/ma75FrozenUniverse.mjs\` converts the archive to the predeclared, hash-identified \`createMa75ForwardManifest\` format. It rejects invalid, duplicate, unsorted, retrospective or silently expanded codes, modified archive counts, fake licensed/corporate-action flags, and any automatic notification/trade/collection enablement. The proposed future OHLCV provider is labelled \`J-Quants\`, with all source rights, original timestamps, corporate-action checks and liquidity certification **UNVERIFIED**. The resulting manifest is **BLOCKED** for production.

\`tests/ma75FrozenUniverse.test.mjs\`: five focused cases, all passing when directly evaluating exact GitHub-fetched source and archive data in the V8 test harness with a deterministic digest stub. Independent Node.js/GitHub Actions CI for this new test and real market data capture remain **not established**. The GitHub file/blob SHA is the reviewable archive identity; the stub digest is **not** a real SHA-256 of a cryptographic research manifest.

A separate fix additionally requires the independent human-review gate to reconcile frozen full-universe breakout counts, five-session summary population size, **all** 15-session waiting/cash records and IDs, and no outstanding unobserved/quarantined outcomes. The review gate's 12 GitHub-source functional tests passed with a hash stub. The Node.js executable test copy available locally passed 64 tests, but it does **not** contain all latest PR modules and cannot be cited as full current PR CI.

**Still not done:** independent verification of J-Quants actual usage/data license, fresh daily-bar capture in the next market session, full-market listing and liquidity source, trading calendar and split provenance, automatic nightly collection, durable source timestamp archive, risk-aware holdout, provider-capacity review. No API requests, paid add-ons, research DB writes, cron registration, alert activation or production merge were performed as part of this freeze.


## Saved daily OHLCV readiness and 953-code inventory (2026-10-31)

A **read-only** audit of existing SIGNALX Supabase tables found that \`daily_stock_results\` had **73,195** rows across **967** format-valid stock codes between 2026-06-29 and 2026-10-30; **953** codes were observed on 2026-10-30 and independently frozen in this PR for future study.

Existing \`display_snapshots\` held **126** distinct \`chart:{code}:1D\` chart snapshots, each **121–123** daily bars. **125** snapshots overlap with the pre-frozen 953 codes and **1** is outside this fixed cohort. Therefore **828/953 codes have no matching saved chart** in this audited snapshot storage; do not infer that they have no upstream price history. Saved chart provider labels were \`yahoo_chart\`, and all histories came from app-viewed charts, introducing chart-selection bias. The latest historical snapshot update was **2026-10-30T12:59:09.601026Z**, which precedes the actual cohort freeze **2026-10-31T13:43:02.737Z**.

A read-only SQL quality check over **15,357** saved candles found **zero** nonnumeric required fields, impossible OHLCV geometries, out-of-order bar timestamps, invalid seconds epoch ranges, zero-volume candles, bars after the snapshot save, or single-session close changes over 45%. These are **basic structural tests only**, not proof of fully adjusted licensed J-Quants or Yahoo data, missing calendar sessions, original point-in-time capture authenticity, adjusted corporate actions, or legal redistribution rights.

- Audit evidence snapshot: \`docs/ma75-archive-inventory-20261031.json\`.
- Historical-only assessment: \`app/lib/research/ma75ArchiveReadiness.mjs\`. It keeps **all 953 codes** in the denominator, reports per-code missing/blocked/history-only states, recomputes last-day SMA75/20-day relative volume from actually saved candles, quarantines duplicates, malformed bars, saved-after-freeze charts, suspected splits, future candles and millisecond epoch errors. It **never** claims forward/live readiness.
- Input adapter: \`app/lib/research/ma75ChartSnapshotAdapter.mjs\`. It accepts only already-saved \`chart:NNNN:1D\` keys with matching \`NNNN.T\` symbols, \`1D\` timeframe, \`yahoo_chart\` provider, matching integer bar counts, parseable PostgreSQL \`updated_at\`, and valid OHLCV/timestamps. It never calls a database or provider and does not certify source rights.
- Ten GitHub-source V8 checks for archive readiness and eight for adapter all passed; the same checks should be rerun with \`node --test tests/ma75ArchiveReadiness.test.mjs tests/ma75ChartSnapshotAdapter.test.mjs\` in a complete PR checkout before merge. Direct functional V8 execution is **not a GitHub Actions or complete Node.js CI result**.

**Remaining blockers:** independently authorized/legal data access and capture provenance, OHLCV for **all 953 fixed codes**, a verified official calendar, split-adjustment rules, a genuine externally archived first forward 15-session window, and risk/cost evaluation. No automatic collection, new paid J-Quants addon, Supabase writes or migrations, live-score/notification promotion, production merge, or unrelated PR #216/#292 change took place.

## Offline J-Quants v2 date-page/76-session research bridge (2026-10-31)

The official [J-Quants API v2 equity daily bars reference](https://jpx-jquants.com/ja/spec/eq-bars-daily) describes \`GET /v2/equities/bars/daily?date=YYYY-MM-DD\` returning all listed securities for one specified date, potentially using \`pagination_key\` for further pages. V2 response data uses a \`data\` array with \`Date\`, \`Code\`, \`O\`, \`H\`, \`L\`, \`C\`, \`Vo\`, and optional \`Adj*\` fields. Adjusted history can be changed retroactively after splits; its original point-in-time version is not available via this endpoint. The implementation therefore **does not use \`Adj*\`** as an as-of feature.

New pure modules with no network/key/DB/cron dependency:

- \`app/lib/research/ma75JQuantsDailyPages.mjs\`: parse explicitly supplied, already acquired API v2 response pages for **one date**. Fail closed on missing, out-of-order, repeating or extra pages; respect the full frozen population even for provider-missing rows; reject duplicate normalized security codes and unexpected security classes/dates; preserve no-trade \`null\` records as \`NO_TRADE\` rather than a zero-price bar. Map normal five-character common-share codes ending in \`0\` to the pre-frozen four-character code. Reject unverified suffixes instead of merging preferred and ordinary shares. Use **unadjusted** O/H/L/C/Vo; all source timestamps and usage rights remain unverified.
- \`app/lib/research/ma75JQuantsWindowAudit.mjs\`: require 76 declared ordered daily sessions with one valid and complete date-page audit for **each** session. Include every frozen symbol, recompute previous SMA75, current SMA75 and previous-20-session volume ratio solely from those 76 sessions, and mark an offline-only crossover if applicable. Missing/null/no-trade data, tampered or mismatched summary counts, split-like >45% close changes, duplicate page dates, pages with unexpected dates and altered symbol mappings cannot become valid crossover results. A declared trading-session calendar is not an independent official exchange-calendar attestation.

The *existing* frozen population has **953** names; this protocol would require **76 complete daily date sets** for full 75-day warmup/previous-close comparison, plus any subsequent forward research. It has **not** requested those dates or stored any response; it cannot backfill genuine close-time evidence from data obtained afterward. Retrospective offline outputs explicitly have \`eligibleForProduction=false\`, \`eligibleForNotifications=false\`, \`generatedForwardSignals=0\`, independently verified provider rights = false, and official calendar = false. A 12-day-delayed data subscription, if used, would remain *historical research*, not a next-session actionable decision.

**Verification**: The two focused GitHub-source test files currently contain **24 total scenarios (13 daily-page + 11 daily-window)**, all passed in a direct V8 functional runner against fetched branch source with only the pre-existing SHA digest shim for frozen-manifest functions. This is **not** a full Node.js or GitHub Actions CI run. A syntax error in the initial 76-session module was detected and corrected before rerunning all tests.

**Release gates not changed**: no fetch of new bars, authentication token access, network requests, Supabase database writes or schema changes, scheduled monitoring, extra paid subscriptions, real-time signals, production promotions, AI POWER modifications, notifications, merges or alterations to PR #216/#292. Independently audited prospective risk-adjusted performance remains unavailable.

## Cost-aware daily acquisition preflight and planned minute add-on (2026-10-31)

The user intends to subscribe to J-Quants' **株価 分足・ティック** add-on (5,500 JPY/month) **on 2026-11-01**. This statement is a **future plan, not an activated account permission**. The add-on is distinct from existing Standard-plan daily OHLCV and does **not** need to be purchased to finish the SMA75 daily-only research. The add-on is useful for separate historical 1-minute studies of intraday dips and rebounds, but the J-Quants help center says minute data is **updated daily, not delivered in real time**: it cannot supply a current-day 09:05 actionable alert. One-minute intervals with no trades are not returned, and the first bar of the day need not be 09:00. Sources: https://jpx-jquants.com/ja/spec/eq-bars-minute and https://jpx-jquants.com/ja/help/data; pricing: https://jpx-jquants.com/ja

### New pure preflight, not an API runner

\`app/lib/research/ma75DataAcquisitionPreflight.mjs\` and \`tests/ma75DataAcquisitionPreflight.test.mjs\` perform an **offline dry-run**, without credentials, API requests, persistence, scheduling, notifications, trading or billing.

- Require the same previously frozen, valid 953-code symbol universe, an **explicit as-of time**, and 76 claimed ordered market sessions ending no earlier than the predeclared first eligible study signal date. No unofficial session list is automatically certified as the official JPX calendar.
- J-Quants v2 \`/equities/bars/daily?date=YYYY-MM-DD\` supports an entire market date per first request. When 76 dates all lack prior reports, the nominal **lower bound is 76 initial date requests** rather than 953×76 individual code requests. **Additional pagination requests are unknown** until actual provider responses are inspected. The Standard account rate limit is nominally **120 requests/minute across the entire account**; the tool's proposed **30 requests/minute** is a conservative *future planning policy only*, not a measured quota or any active job. Official docs: https://jpx-jquants.com/ja/spec/eq-bars-daily and https://jpx-jquants.com/ja/spec/rate-limits.
- Audit each previously archived date-page report: an incorrect source version, missing continuation page, count mismatch, incomplete code-day, duplicate date, absent bar or tampered code order becomes an unverified state rather than automatically being skipped. Preserve missing codes in the fixed denominator.
- A pre-existing archived provider report must also carry a parseable `lastReceivedAt` not later than the explicit preflight `asOf` timestamp and not earlier than the trade date's close. A future-dated or missing capture timestamp fails the historical reuse check; this does **not** independently verify a claimed provider timestamp.
- If a requested study day has not reached its 15:30 JST close, classify it as **not yet closed**. After close but before the expected J-Quants daily data update **around 16:30 JST**, classify it as **waiting for the provider update**. The update time is an approximate official schedule, not proof of availability. Source: https://jpx-jquants.com/en/spec/data-update.
- Accept \`minuteAddonStatus='PLANNED'\` (and other explicitly declared states), but **never convert it to provider-verified active**; expose \`minuteAddonRealtimeSupported=false\`, \`minuteAddonUpdatesOnlyDaily=true\`, \`minuteAddonHistoricalRetentionYears=2\`, \`allowedToRunApiCalls=false\`, \`allowedToSpendMoney=false\`, \`eligibleForNotifications=false\`, and \`eligibleForProduction=false\` regardless of any caller input.
- Do not use delayed (e.g. 12-day-old) provider data as an authentic snapshot at the original 09:05 decision time. Later historical studies may audit which signals would have existed, but such outputs are not independently captured trading opportunities.

**Verification:** 12/12 dedicated tests passed when run as JavaScript directly from the exact GitHub branch content in a V8 harness (only the pre-existing frozen-manifest crypto digest was shimmed). This is **not an entire GitHub Actions CI, production build, or end-to-end J-Quants API execution**. No missing OHLCV was fetched and no monthly subscription was activated as part of this PR.


## 2026-10-31 Daily archive fail-closed audit refinements

**Why**: A provider-complete page can contain honest \`NO_TRADE\` code-days. The previous daily acquisition preflight considered a date entirely complete when every code had either a \`DAILY_BAR\` or a \`NO_TRADE\` record; that is not sufficient for **all 953 codes to compute a continuous 75-day SMA**. A complete *response envelope* is not the same as *complete OHLCV history*.

**Research-only corrections** (nothing activated):

1. \`ma75DataAcquisitionPreflight.mjs\` now reports \`ARCHIVED_NO_TRADE_GAP\` for correctly archived date pages that include any \`NO_TRADE\` code. This is distinct from \`PREVIOUS_AUDIT_INCOMPLETE\`: a legitimate no-trade record should neither be fabricated as a valid candle nor repeatedly fetched to hide an unavailable signal. \`structuralHistoricalInputsPresent\` stays false until **every frozen code has an actual valid daily OHLCV bar for all 76 sessions**.
2. For the entire frozen \`codes × 76\` denominator, the preflight reports \`archivedUsableBarCells\`, \`archivedNoTradeCells\`, and \`unverifiedOrMissingBarCells\`. Validated snapshot counts must reconcile with per-code statuses. A future-dated receipt, missing or mismatched count, duplicate source report, or missing provider row never inflates the completed-bar count. The test fixture of 3 symbols × 76 sessions therefore has 228 expected cells; one legitimate no-trade record produces 227 usable, 1 no-trade, 0 unverified, **but cannot pass full SMA75 readiness**.
3. \`ma75JQuantsDailyPages.mjs\` now treats \`pagination_key: ""\` as a **terminal response**, consistent with the J-Quants FAQ that both absent and empty keys mean no more pages. Each archived page must explicitly record the key used in its request, and received-at instants must never move backwards across pages. Missing requests, reversed receipt times, invalid continuation types and truncated page sequences quarantine the date scope. See the [official API FAQ](https://jpx-jquants.com/ja/help/data) and [daily bars specification](https://jpx-jquants.com/ja/spec/eq-bars-daily).
4. No newly observed market bars, independently authenticated point-in-time timestamps, certified corporate-action history, or verified exchange calendar were created. A daily response captured much later is still **retrospective research**, not evidence of an actionable signal at the original morning decision time.

**Focused verification**: the current GitHub branch's three connected modules (\`ma75JQuantsDailyPages\`, \`ma75JQuantsWindowAudit\`, \`ma75DataAcquisitionPreflight\`) and associated tests were fetched and executed in a direct V8 JavaScript harness, with only the frozen protocol's SHA-256 digest replaced for the isolated test runner. **45/45 passed (17 date pages + 11 76-session windows + 17 preflight)**. The private repository was not directly reachable from the container's Git client, so these are **not full Node.js checkout, GitHub Actions, or integrated API test results**.

No billing change, API keys/read, provider requests, database writes, cron, Vercel production deployment, AI POWER scoring or notifications were performed. PR #297 remains a separate Draft; unrelated PRs remain untouched.
