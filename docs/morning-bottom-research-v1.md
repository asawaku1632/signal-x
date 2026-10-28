# SIGNALX Morning Bottom Research — data contract and rollout (shadow only)

## Goal
Discover historically frequent morning-low time windows, low price relative to prior close, and subsequent rebound frequencies after an opening selloff. Real-time data and 1-minute bars are NOT prerequisites. Prefer daily post-close ingestion; delayed historical feeds are acceptable if provider terms and retention allow.

## What is already stored (read-only production inventory, 2026-10-28)
- `entry_time_shadow_runs`: 11 run records (2026-10-14 through 2026-10-28); its `results` include scheduled-entry prices, not complete intraday OHLC series.
- `shadow_candle_research_runs`: 17 run records; `events` contain daily candlestick pattern events and 1/3/5-day outcomes, not minute-by-minute bars.
- No obvious dedicated raw intraday-bar table appeared in the inspected public table names. This does **not** rule out other schemas, object storage or external retention.
- Do not infer 9:42, rebound percentages or an actual tradable bottom from these run counts.

## Immutable input record (planned adapter)
- `code`, `tradeDate`, `previousTradingDate`, `previousClose`.
- `featureAvailableAt`, prior-day frozen AI POWER, prior return/range/volume ratio; **never** reconstructed from later information.
- `source`, provider/license, `retrievedAt`, original bar timezone, interval, bar start/end semantics, revision ID and completeness.
- Per-bar `date`, `time` (Asia/Tokyo start), `open`, `high`, `low`, `close`, optionally volume.
- Deduplicate on provider+code+date+bar start+interval; retain corrections with revision provenance, not silent overwrite.

## Research definition
- Opening sharp drop: 09:00–09:30 observed minimum <= prior close × (1 − threshold).
- Morning low: 09:00–11:30 minimum. If the minimum occurs in multiple bars, first occurrence is used; preserve ties for audit.
- Frequency histogram: e.g. 5-minute intervals, not false minute-level precision.
- Rebound: subsequent **later-bar** maximum high >= low × 1.01 / 1.02. A high in the same low bar is excluded because event ordering is unknowable.
- Denominator: all complete, eligible stock-days, including failures; show `observed`, `wins`, excluded counts, and minimum sample gate.
- 1-minute bars optional; 5-minute/15-minute bars useful for coarser windows.
- Important: a morning low can be exceeded by a lower **afternoon** low. Morning-bottom statistics are not full-day-bottom statistics.

## Operational safety gates
1. Verify provider allows historical retention and analysis; do not silently store unlicensed data.
2. Read-only inventory of existing sources and saved outcomes first; backfill only missing dates and allowed bar intervals.
3. Ingestion is idempotent, rate-limited and post-close; do not activate new cron or paid feeds without review.
4. Reject missing bars, inconsistent OHLC, duplicate timestamps, invalid timezone or incomplete session; report exclusions.
5. Separate **retrospective observed rebound frequency** from **out-of-sample predicted probability** and from **executable strategy win rate**.
6. Walk-forward validation: prior dates only for model selection; test on later held-out dates. Report confidence intervals, sample size, drawdown, costs and missed fills.
7. Keep this module and any future UI shadow-only until independently verified. No live signals or notifications.
8. PR #216 must remain untouched; no production DB writes, migrations or deploys in this PR.

## Current implementation
`app/lib/research/morningAnalog.mjs` exposes `inspectMorning`, `summarizeMorningDropPatterns`, `summarizeAnalogs`. Test fixtures in `tests/morning-analog.test.mjs`. No production data adapter, persistence, cron or UI wiring has been activated.

## Next executable milestone
Locate a legitimate retained OHLC source, confirm exact timestamp convention, then build an **offline read-only adapter** to convert a bounded set of real historical stock-days into the strict input record. Run tests and compute real cohort counts before discussing a forecast display.


## Read-only daily baseline audit (2026-10-28, production snapshot)

This is the saved **daily** dataset, not 5-minute/15-minute OHLC and not a tradable prediction. Queries were SELECT-only; no production writes.

- `public.daily_stock_results`: 71,289 rows, 76 distinct dates, 967 codes; dates 2026-06-29 through 2026-10-28.
- `next_price > 0 AND price > 0`: 70,283 rows (98.59%); 1,006 rows have null `next_price`; no duplicate date/code pairs observed.
- Positive later price: 33,599; negative: 31,319; unchanged: 5,365. These counts total 70,283.
- `checked_at` date (DB session date) was after row `date` for 68,375 rows and the same date for 1,908 rows. **Price as-of semantics and provider quality are not independently certified.**

| Stored score band | Matched rows | Mean percentage change | Positive price fraction |
| --- | ---: | ---: | ---: |
| 0–49 | 35,995 | +0.0290% | 49.76% |
| 50–69 | 12,518 | -0.0824% | 45.29% |
| 70–79 | 5,276 | -0.0155% | 46.04% |
| 80–84 | 2,486 | +0.0216% | 45.58% |
| 85–89 | 3,749 | -0.0343% | 46.28% |
| 90–94 | 4,160 | +0.0131% | 46.51% |
| 95–100 | 6,099 | -0.0189% | 45.12% |

`score >= 85`: 14,008 matched records, 69 distinct dates, mean change -0.0135%, median 0.0000%, 45.85% positive. `score < 85`: 56,275 matched records, 75 dates, mean -0.0003%, median 0.0000%, 48.23% positive. Score buckets are **not yet verified as equivalent to the current UI's AI POWER**.

**Interpretation lock:** These descriptive returns are computed as `100 * (next_price / price - 1)` from stored columns. They do not establish executable fill, next-day horizon, price-source quality, sign/direction-adjusted performance, risk-adjusted advantage, calibrated probabilities, or morning-low timing. The raw data do not show a monotonic positive relationship between higher stored `score` and positive later price. Do not ship a score-to-trading-signal rule from these aggregates.

Next: verify `next_price` timing and `score` generation code; stratify by market direction and date and run chronological held-out tests. Morning-low research separately requires complete provenance-verified intraday OHLC, which is not furnished by this daily table.


## Follow-up daily learning audit (2026-10-29, SELECT-only)

Code inspection in `app/lib/dailyLearning.ts` shows stored `score` is selected from `stock.score ?? stock.aiPower ?? 0`; do not assume historical score is uniformly current AI POWER. In `app/lib/learning/checkDailyRunner.ts`, the candidate comparison date is the next available stored date selected by the runner's completeness guard, and `next_price` is the saved `price` of the matching code on that selected date. Historical population may include different legacy runner versions and needs independent provenance auditing.

`daily_result_price_provenance` (production read-only snapshot): 11,436 provenance rows with target trade dates between 2026-10-09 and 2026-10-27. 11,194 satisfy the full target/source/date/price/code consistency join (97.88%); 242 do not. Component breakdown: target `next_price` mismatch 242; missing target row 0, missing source row 0, source `price` mismatch 0, judged result mismatch 0, target date mismatch 0, source date mismatch 0. Preserve as an audit anomaly, not proof of a specific cause. Do not treat all 70,283 priced comparisons as provenance-verified.

### Ex-post market-wide date regimes — descriptive, NOT predictive

This stratification groups each **completed date** by the mean saved price change across its priced records: `BROAD_UP` > +0.25%, `BROAD_DOWN` < -0.25%, otherwise `FLAT`. The regime therefore uses outcomes and **must never be an input to a pre-trade recommendation**. Score bands and dates have unequal population sizes.

| Ex-post regime | Stored score | Rows | Dates | Mean change | Positive fraction |
| --- | --- | ---: | ---: | ---: | ---: |
| BROAD_DOWN | <85 | 15,108 | 20 | -1.2051% | 30.13% |
| BROAD_DOWN | >=85 | 3,536 | 18 | -1.1823% | 29.10% |
| BROAD_UP | <85 | 22,509 | 30 | +0.7792% | 67.27% |
| BROAD_UP | >=85 | 5,218 | 27 | +0.7759% | 65.96% |
| FLAT | <85 | 18,658 | 25 | +0.0349% | 40.06% |
| FLAT | >=85 | 5,254 | 24 | -0.0109% | 37.32% |

Future research must use **prior-day observable** market-state features instead of this retrospective label, audit the 242 provenance discrepancies without modifying originals, and compare held-out chronological cohorts. None of this is intraday OHLC evidence.


### Resolution of 242 exact-comparison discrepancies (2026-10-29, SELECT-only)

Follow-up measurements show all 242 strict-float unequal pairs differ by no more than `4.54747350886464e-13` price units: 122 positive differences, 120 negative. Comparison with `ABS(next_price - source_price) > 0.000001` yielded **0 material differences** among the traced rows. This is consistent with floating-point representation; do not classify those 242 as economically different market quotes. The earlier 11,194 strict equal count remains a description of bitwise/numeric equality, not a price-integrity failure count. This does **not** certify independent provider correctness or untraced legacy records.

Table-name discovery in the `public` schema for `bar`, `minute`, `intraday`, `candle`, and `ohlc` returned only `shadow_candle_auto_control`, `shadow_candle_auto_daily_runs`, `shadow_candle_research_runs`. No dedicated raw intraday OHLC table was identified by that name search. Other schemas, storage objects, or external retention remain unexamined.


## Expanded intraday retention inventory (2026-10-29, production SELECT-only + repository inspection)

- Production `storage.buckets` returned **zero buckets** at inspection time. This does not inspect external files/services.
- No dedicated minute/5-minute/15-minute OHLC table was identified in visible application tables. Tables related to daily price references or shadow candle runs are **not** evidence of stored raw intraday OHLC.
- Source inspection shows existing **fetch-only** paths for Yahoo Finance 5m candles: `app/lib/research/entryTimeShadowRunner.ts` and `app/lib/research/weakAiReboundRunner.ts` use `range=5d&interval=5m`; `app/lib/research/morningFinalCheckRunner.ts` and `app/api/stock/[code]/route.ts` use `range=1d&interval=5m`. These URLs establish code behavior, not provider licensing, coverage guarantees, or persistence.
- Do **not** run bulk fetches or backfills, add cron, or treat Yahoo endpoints as commercially licensed historical research storage based on these findings. Confirm provider terms, data provenance, timestamp meaning, bar completeness and retention permission before generating actual intraday statistics.
- Near-term best evidence remains the 70,283 matched daily records, with outcome-price provenance limitations already documented above. Train/test split must respect trade dates, and a snapshot's `score` cannot be presumed to be the same algorithm across all stored dates.


## Chronological daily saved-score split (2026-10-29, SELECT-only)

Exploratory split of **75 distinct matched outcome dates**, ordered by stored target date; first 37 dates TRAIN (2026-06-29 through 2026-09-01), remaining 38 dates HOLDOUT (2026-09-02 through 2026-10-27). The cut is by date, not a random split of stock rows. Score 85 is a fixed illustrative threshold, **not** a retrospectively optimized rule. All comparisons use `100*(next_price/price-1)`; this is not a tradable execution backtest.

| Split | Stored score | Rows | Dates represented | Mean return | Median return | Positive fraction |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| TRAIN | >=85 | 9,233 | 31 | +0.0613% | 0.0000% | 47.35% |
| TRAIN | <85 | 24,793 | 37 | +0.0865% | 0.0000% | 49.50% |
| HOLDOUT | >=85 | 4,775 | 38 | -0.1581% | -0.0638% | 43.14% |
| HOLDOUT | <85 | 31,482 | 38 | -0.0686% | 0.0000% | 47.31% |

**Result:** In this limited split, higher saved score fails to deliver higher positive-price frequency in either period, and the high-score average is negative in the later period. This does not prove the score has zero predictive information after controlling for direction, market regimes and algorithm versions. Group coverage differs by date. Future work: compare date-matched cohorts, verify next-price provenance, score-version consistency, prior-day available features, and risk/cost. This table cannot be used to infer intraday bottom timing, or to activate a signal, trade, or notification.


## Same-date matched score-group comparison (2026-10-29, production SELECT-only)

Within each target `date`, compare stored `score >= 85` against `score < 85`. Include only dates with at least 10 priced observations in **each** group. Define day difference as mean `100*(next_price/price-1)` for the high group minus the mean for the low group. Each qualifying date has equal weight in the headline mean, even though stock counts differ. This removes common calendar-date variation from the comparison but does not adjust sector, direction, score-version or source-quality effects.

- 68 comparable dates, 14,003 high-score stock-days and 51,001 lower-score stock-days (65,004 total).
- Equal-date average difference **-0.0872 percentage points**; median **-0.0143 pp**. High group outperformed on 31 dates, underperformed on 36, tied on 1.
- Average day-by-day difference in positive-price fraction: **-2.939 percentage points**.
- Early period (before 2026-09-02): 30 comparable dates, mean gap -0.1117 pp, high group outperformed on 12.
- Later period (2026-09-02 onward): 38 comparable dates, mean gap -0.0678 pp, high group outperformed on 19.

These retrospective observations **do not support** shipping an unconditional `score >= 85` bullish rule. They also **do not** prove absence of conditional predictive value or evaluate short-direction signals. This is not an intraday morning-low study or a tradable backtest. Next research stage should use provenance-confirmed cohorts, frozen prior-day feature versions, direction-aware labels, date-matched cross-sectional ranks and chronological holdouts, and should report uncertainty.


## Exploratory condition research and temporal replication failure (2026-10-29, SELECT-only)

For each stock, order saved daily rows by `date`. Define prior 3-record price change from the third preceding saved observation and score delta from the immediately preceding saved observation; these are record-count offsets, **not guaranteed consecutive market sessions**. Require valid saved `price`, `next_price`, prior score and prior price. Outcome is `100*(next_price/price-1)`. The source and as-of availability of each historical score/price remains unverified.

Exploratory mutually exclusive groups:

| Condition | Matched observations | Mean subsequent stored-price change | Positive-price fraction |
|---|---:|---:|---:|
| Score >=85, score delta >=10, prior 3-record return <=-5% | 572 | +0.4245% | 48.95% |
| Score >=85, score delta >=10, other prior return | 7,918 | -0.0846% | 44.13% |
| Score >=85, score delta <10, prior 3-record return <=-5% | 292 | +1.3015% | 75.34% |
| All remaining eligible observations | 58,600 | -0.0163% | 48.41% |

**Critical chronological check for the apparently strongest group** (cut 2026-09-02):

| Period | Pattern records | Pattern positive rate | Pattern mean return | All other records positive rate |
|---|---:|---:|---:|---:|
| EARLY (before 2026-09-02) | 265 across 18 dates | 78.11% | +1.4694% | 49.30% |
| LATE (2026-09-02 onward) | 27 across 12 dates | 48.15% | -0.3467% | 46.73% |

The pattern shows **no demonstrated forward robustness** in this date split; a large retrospective aggregate is driven by the earlier observations. Conditions were explored on the full dataset, so the later-period comparison is diagnostic, **not a pristine out-of-sample test**. Small late sample (27) adds uncertainty. Do not use this as a validated buy signal, probability, or notification. Future evaluation should preregister conditions, audit point-in-time price/score availability, compare common-date and market-matched baselines, and collect unseen prospective observations.

This is daily saved-price research only; it does not resolve PR #292's requirement for licensed, complete historical intraday OHLC.


## Preregistered forward-only daily cohort (frozen 2026-10-29, shadow)

`evaluateFrozenDailyDropRule` in `app/lib/research/savedDailyBaseline.mjs` now provides a **pure offline evaluator** for a fixed diagnostic cohort: stored score >=85, score change from preceding saved record <10, prior 3-record price return <=-5%. Freeze timestamp is `2026-10-29T00:00:00+09:00`, and only target dates strictly **after 2026-10-29** can enter. All rule parameters are immutable in this version; no dynamic tuning, service calls, database writes, cron, notifications or signals. It rejects malformed inputs and duplicates, records exclusions, and suppresses positive fraction until 30 complete outcomes.

The historical 292 rows / 75.34% retrospective positive fraction are **research discovery only** and cannot enter this prospective evaluator. Any future input must be generated from point-in-time frozen features, with independent source provenance and subsequent outcome audit; this function does not establish their trustworthiness. No production connection or automated feed is wired. Prospective evidence remains uncollected.


## Prospective provenance gate tightening (2026-10-29)

The frozen shadow evaluator now fails closed unless every candidate includes `featureProvenanceVerified: true`, an ISO `featureAvailableAt` instant **strictly before** the candidate's trading date starts in JST, `outcomeProvenanceVerified: true`, and `outcomeTradeDate` strictly later than the target date. Missing, invalid, same-day or future feature timestamps and absent/not-later outcome provenance are excluded and counted separately. These flags are assertions by the exporting caller; the evaluator does **not** independently validate a provider or license. As-of availability, provenance, and complete historical outcomes must be externally audited before trusting computed statistics. No live data pipeline is connected.


## Production point-in-time eligibility inventory (2026-10-29, SELECT only)

- Of 70,283 `daily_stock_results` records with positive saved `price` and `next_price`, 11,436 match a `daily_result_price_provenance` row. Each of those 11,436 has a later `source_trade_date` than `trade_date` and a non-null `source_snapshot_created_at`.
- Schema inspection: `daily_stock_results` has `date`, `score`, `created_at`, but no explicit immutable `featureAvailableAt` or separate point-in-time provenance for `previousScore` and `prior3ReturnPct`. `created_at` is not by itself proof that every feature was available as of the previous trading day's close. `daily_result_price_provenance` traces later outcome source, not all prior-day features.
- These results document **outcome traceability only** for a subset. They do not establish that 11,436 records pass the frozen prospective evaluator's required pre-trade feature provenance. Do not label any number as fully eligible until a separate as-of feature audit has been completed. Do not populate the `featureProvenanceVerified` flag by assumption.
- This inventory is for daily outcomes, not raw historical morning OHLC. No live wiring, bulk fetch, database mutation or deployment was performed.


## Daily snapshot chronology inspection (2026-10-29, production SELECT-only)

Source: `public.daily_stock_results` (71,289 records). Comparing the date component of `created_at` with stored `date`: 71,289 saved on the same calendar date as their target date; **zero** rows bear an earlier calendar date in this comparison. `created_at` is a timestamp *without time zone*: the raw date comparison is not evidence of the clock timezone or pre-market availability. The observed timestamp range was `2026-06-29 12:12:40.172293` to `2026-10-28 06:35:34.503624`.

When records are ordered by `date` within each `code`, 70,322 rows have an earlier saved-score observation with an earlier-date creation timestamp; 967 have no preceding saved row. 68,388 rows have an earlier third-preceding saved date. These counts are structural availability of **prior historical rows**, not assurance that current-day score, all constituent signals, or the retrospectively computed prior-3-row change were genuinely frozen at a permissible decision cutoff.

**Safety decision:** do not infer `featureProvenanceVerified=true` or `featureAvailableAt` for current-day features from this table's `created_at`. Prospective rule evaluation remains blocked until an independently auditable, timestamped pre-decision feature snapshot exists. Prior-row signals may be researched separately after verifying the original timestamps, source definitions, trading-calendar continuity, and score-version changes. No live signal activation.


## Prior-saved-score same-date research (2026-10-29; SELECT-only)

For each code sorted by stored date, take `LAG(score)`, `LAG(price)` and `LAG(created_at)`. Require preceding score/price and preceding creation calendar date earlier than target date; evaluate target's stored `100*(next_price/price-1)` only retrospectively. Within each date require at least ten observations in prior-score >=85 and prior-score <85 groups, take the difference of group mean later-price returns, and average daily gaps with equal-day weighting.

| Period | Comparable days | Prior-score >=85 records | Prior-score <85 records | Mean high-minus-low gap | Days high group outperformed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before 2026-09-02 | 30 | 8,886 | 19,372 | -0.1127 pp | 13 |
| 2026-09-02 onward | 38 | 5,087 | 31,168 | +0.1500 pp | 20 |

The later group gap is positive, but higher-score days outperformed on only 20/38 dates. Do not present this as validated trading alpha or a calibrated next-day probability. `created_at` is timestamp without timezone; later `price` and `next_price` are not validated executable fills, and previous saved dates can skip sessions. The second interval is a retrospective diagnostic using an already explored threshold, not a fresh prospective holdout. No trading/notification activation. This daily result does not establish intraday bottom-hour statistics.

## Robustness to extreme days (2026-10-29, read-only research)

In the later 38 date-matched days, the mean difference between previous saved score >=85 and <85 was +0.1500 percentage points. The daily differences ranged from -1.3745 to +1.6686 pp. Removing the three days with the largest **absolute** differences (both signs eligible) reduced the mean difference among the remaining 35 days to +0.0319 pp. This is a retrospective sensitivity check, not a tradable signal or independent validation. The apparent advantage is materially influenced by extreme dates; no stable advantage is established. Code-level stock concentration statistics are not verified and must not be inferred from this exercise.

## Later-period stock occurrence concentration (2026-10-29, production read-only)

For saved records dated 2026-09-02 onward, with positive `price`/`next_price`, previous saved score >=85 and previous row created on a prior calendar date: **5,087 observations across 924 unique codes**. Maximum appearance count per individual code was **18**. The 10 most frequently appearing codes contributed **155 of 5,087 observations (3.05%)**. Thus, by *observation count*, no small set of ten symbols dominates. This is **not** a contribution-to-return analysis; outlier returns on individual symbols can still strongly affect observed advantage. Prior-score availability and provenance constraints remain as previously documented. This is retrospective daily research, not an intraday finding or authorization for trading/alerts.

## Stock contribution and clipping sensitivity (2026-10-29, SELECT-only)

For post-2026-09-02 priced observations with previous saved score >=85 and a preceding record created on an earlier date: 5,087 observations, 924 codes. Summed observation returns equal +171.4905 percentage points, a **non-investable arithmetic sum**, not portfolio returns. Summing per-code contributions: positive-code contributions totaled +1746.4442 points, negative-code contributions -1574.9538 points; highest individual code total +53.0825, lowest -95.1526 points. Opposing stock contributions largely cancel. Do not infer actual P/L or weights.

For the 38 comparable dates with >=10 observations in each previous-score cohort, same-date mean high-minus-low difference was +0.1500 percentage points. Clipping each individual saved-price return to [-5%,+5%] **before** computing group daily means and then averaging equally across dates resulted in +0.1286 pp. Thus extreme individual observations do not entirely explain the daily gap. A separate retrospective diagnostic excluding the three largest absolute day gaps yielded +0.0319 pp. These are distinct sensitivity methods and should not be conflated. No statistical significance or reliable tradable advantage has been established; dates, code weights, as-of score provenance, and executable pricing remain limitations.


## Batch offline robustness implementation and late-period regime audit (2026-10-29)

The standalone pure offline function `researchPriorScoreDailyGaps` was added to `app/lib/research/priorScoreRobustness.mjs`; a dedicated 34-case regression suite was added and wired into `morning-analog-ci.yml`. It accepts caller-supplied observations only; **no database, quote, cron, trading, alert, or API actions** are implemented. Input requires prior-score evidence date before target day, explicit provenance assertion for prior score, and a verified later-price date. These fields are assertions to be independently audited and **cannot** be populated by assumption.

Within the 38 comparable dates from 2026-09-02 onward, classify each date based on the **observed full-day mean saved-price return**, which is retrospectively available only. A common-date difference measures prior-score >=85 group return minus prior-score <85 group return.

| Ex-post regime | Dates | Equal-date mean gap (pp) | Days high group outperformed |
| --- | ---: | ---: | ---: |
| UP (day mean > +0.25%) | 13 | +0.3141 | 8 |
| FLAT (between -0.25 and +0.25%) | 13 | +0.0979 | 7 |
| DOWN (day mean < -0.25%) | 12 | +0.0287 | 6 |

The greatest descriptive gap occurs in UP days, but this is **not** a usable pretrade market-state classifier. Outcomes determine the regime, so reusing it as a day-of-decision signal would be lookahead. Previous extreme-date and clip-sensitivity warnings still apply. No operational benefit has been established.
