# SIGNALX Dual-Surge Research — Phase 2 Protocol (2026-10-24)

Status: RESEARCH ONLY / PROTOCOL DRAFT / NO PRODUCTION CHANGE

## 1. Frozen exploratory baseline

Source: manually retrieved J-Quants V2 read-only diagnostic batches 1–5, cutoff 2026-10-23, curated 20 securities (non-representative), 35 valid daily OHLCV records per security. Tokyo Electron (8035) had 35 valid rows but detector unavailable due to `CORPORATE_ACTION_UNADJUSTED`; exclude from signal denominators rather than treat as a negative.

- 20 codes requested; 19 eligible for detector; 1 excluded for corporate-action handling.
- 24 independent first-signal events after grouping consecutive signals within cohort.
- 15 first-signal events have matured five-session close-to-close outcomes; 9 pending.
- Of 15 matured: 11 positive and 4 negative; **not** an estimated prospective win rate.
- 5-day outcomes: below/equal -5%: 1; between -5% and 0%: 3; from 0% to below +5%: 7; from +5% to below +10%: 3; at least +10%: 1.
- Two distinct detector cohorts: `PRE_SURGE_V1` and `SURGE_START_V1`. Never pool them without cohort stratification.
- Important examples: 6981 PRE_SURGE 2026-10-06: 5d -15.041%, 10d -23.479%; 3762 SURGE_START 2026-10-06: 5d +22.476%; 4502 PRE_SURGE 2026-10-08: 5d +6.998%.
- `persisted:false`; `licenseForAutomatedResearch:NOT_VERIFIED`. No assertion that research data is saved or licensed for automated collection.

## 2. Pre-registered hypotheses (not findings)

H1: PRE_SURGE and SURGE_START have different 5-session return and +5% tail distributions.
H2: At signal close, volume ratio, same-day return, and distance to prior 20-session high may separate +5% winners from drawdowns. Test fixed buckets and continuous measures; do not optimize cutoffs on evaluation data.
H3: A pre-specified risk filter can reduce frequency of <= -5% five-session outcomes, subject to missed-upside and coverage penalties.
H4: Transition from PRE_SURGE to SURGE_START may describe a historical pathway. A transition is **not knowable at initial PRE_SURGE entry**; measure it only as a sequential, time-indexed state.

## 3. Leakage-free event and outcome rules

1. Compute indicators using bars known by each signal decision timestamp only. Specify whether decision is at close (then earliest hypothetical entry is next session) or at next open; never pretend signal-close execution is possible after observing that close.
2. Calculate the 20-session high only from data available at that timestamp; document whether the current bar is included.
3. Use a fixed corporate-action adjustment policy and quarantine unadjusted splits/rights events, suspensions, missing or stale bars; do not label exclusions as no-signal.
4. Keep consecutive signals in one cohort as one event; do not count subsequent daily signals as independent observations. Predefine a non-overlap/embargo period for re-entry events to avoid overlapping outcomes.
5. For each event, record signal timestamp, decision timestamp, first tradable entry assumption, OHLCV freshness, eligibility, features, cohort, exclusion reason, forward returns, and maturity flag. Missing future bars are PENDING, not losses.
6. Track both signal-close-to-future-close (diagnostic comparability) and next-open-to-future-close (execution proxy), separately. Include spread, fees, slippage, gap risk, limit-up/down and liquidity assumptions when moving toward tradability.
7. Define primary endpoint **5-session next-open-to-close net return** for a later executable backtest, with secondary endpoints 1/3/10-session returns, +5% / +10% event rates, <= -5% tail risk, maximum adverse excursion and opportunity coverage. Baseline historical close-to-close is **not** this primary endpoint.
8. No use of future consecutive-day status as an initial-entry predictor. Re-evaluate a state only after the next session completes.

## 4. Evaluation design

- Freeze detector versions, buckets, event grouping, entry/exit and exclusion rules before examining holdout results.
- Expand history with an authorized data source only after rights are verified; manual owner-only read-only inspection remains the current mode.
- Use chronological development / validation / untouched out-of-time test partitions, preferably rolling walk-forward folds with a purge/embargo at least as long as the longest forward horizon.
- Report per-cohort event counts, eligible universe, signal coverage, positives, +5% and +10% hits, <= -5% drawdowns, median/mean, uncertainty intervals, and time-period/sector concentration.
- Benchmark against pre-defined unconditional universe returns and simple momentum/volume rules evaluated over identical timestamps and eligibility. Do not compare signal outcomes to a cherry-picked baseline.
- Require sufficient independent events (at least 30 matured per tested bucket as an initial minimum, ideally materially more) before interpreting feature effects; sparse cohorts must be labelled INSUFFICIENT_SAMPLE.
- Explicitly track survivorship bias, corporate actions, market regimes, multiple testing, correlated events, and the fact that the initial 20 names were curated.
- No live trading recommendation, automatic order, alert, database persistence, production change, or merge to main under this protocol.

## 5. Next implementation sequence (approval required for changes)

A. Audit the detector code for timestamp/20-day-high definitions, corporate-action policy and grouping edge cases.
B. Produce a read-only event ledger schema and deterministic tests using synthetic OHLCV, including pending/excluded/overlap cases.
C. Add **research-only** aggregate diagnostics for +5%, +10%, <= -5% and per-cohort uncertainty, without changing existing public UI.
D. Only after source rights are verified, plan larger historical acquisition and out-of-time evaluation. Do not enable background fetch or persistence implicitly.

## 6. Interpretation guardrails

The 11/15 positive count is a descriptive statistic for selected historical cases, **not** a 73.3% forecast or proof of skill. A single -15.041% case and a single +22.476% case dominate intuitive impressions; do not fit a model or tune filters to those examples and report in-sample performance as validation.
