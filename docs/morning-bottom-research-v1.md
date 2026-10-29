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

## Manual local-file robustness report (2026-10-29)

Added `scripts/report-prior-score-robustness.mjs` and its 8-check input-boundary test suite. This CLI accepts exactly one **locally prepared and approved JSON array file** and outputs a research-only JSON summary using the existing `researchPriorScoreDailyGaps` pure function. No database connection, Yahoo fetch, cron, notifications, live API or persistence is included. File size is bounded at 25 MiB and record count at 100,000. It requires the exported `priorEvidenceVerified` and `outcomeProvenanceVerified` flags; **do not set these flags without independently confirmed immutable records and provenance**. No production data was exported or run through this CLI in this change. Example invocation: `node scripts/report-prior-score-robustness.mjs ./approved-export.json`. Never put credentials in the input file. The report's historical regime values use future outcome prices and are unsuitable for live signals.

## Offline input provenance diagnostic (2026-10-29)

The local JSON reporting CLI now emits `inputAudit`: input row count, number of missing prior-evidence assertions, number of missing later-outcome assertions, and invalid input objects. Critically `independentlyVerifiedByCli` is always `false`; flags provided in a JSON file are merely caller assertions and **not independently verified provenance**. Two regression tests ensure missing evidence is counted and even fully asserted input cannot be mislabeled as independently validated. No production export or live data hookup was performed.

## Offline evidence classifier (2026-10-29)

Added `app/lib/research/evidenceClassifier.mjs` and 14 isolated tests. The classifier receives caller-supplied rows, rejects missing/late preceding feature evidence, missing or nonfuture source dates, duplicate or malformed records, and source-to-outcome prices differing by more than 0.000001 price units. Every row marked `EVIDENCE_ASSERTED` remains **not independently verified**: the offline function cannot authenticate its caller, provider, rights, immutable snapshot, or exchange market time. Its output always says `independentlyVerified:false` and is not permission to publish predictions or use data in production. No database query, export, cron, or market-data fetch is wired into this code.

## Classified offline report input (2026-10-29)

The local JSON report now runs the offline evidence classifier before the date-matched research calculation. The resulting report includes `evidenceClassification.summary` (acceptance and exclusion reasons), `assertedRowsPassedToAnalysis`, and `independentlyVerified:false`. Required source fields include `priorAvailableAt`, `sourceDate`, and `sourcePrice` in addition to prior-score and outcome assertions. Rows without these fields are intentionally excluded from analysis. The source date is mapped to the existing evaluator's `outcomeDate` field only after classification. Two regression tests cover mixed accepted and rejected records and late prior-feature timestamps. This is structural consistency of caller assertions only, not independent provider verification, investment performance or production authorization.

## Manual read-only daily export template (2026-10-29)

`app/lib/research/dailyExportTemplate.mjs` now holds a **non-executing** SQL template for authorized, manually reviewed extraction of prior saved scores and outcome price provenance. Seven unit tests enforce SELECT-only intent, scope, and deliberate failure-closed evidence fields. The template sets `prior_available_at = NULL`, `prior_evidence_verified = false` and `outcome_provenance_verified = false` because immutable as-of and independent provider verification are not established. Consequently it is **not** a ready-to-run analysis feed and cannot produce accepted samples in the gated report. It exposes SQL snake_case column aliases, whereas the report expects explicitly validated camelCase evidence fields; a future audited normalization step is still necessary. No automatic extraction, DB writes, live API, cron or trading signal is wired. Production read-only inventory reconfirmed 71,289 daily records, 11,436 outcome provenance rows, and all 71,289 created on their date's calendar day in the stored timestamp representation; these facts do not prove prior-day availability.

## SQL-export normalization (2026-10-29)

The pure `normalizeDailyExportRows` converter maps approved SQL snake_case fields and numeric strings to the offline report input. It deliberately resets `priorAvailableAt` to null and both provenance verification flags to false, ignoring any user-supplied verification values from raw SQL rows. The manual local-file report detects SQL-export shape (`next_price`) and normalizes it before running structural evidence classification. Thus a raw export **cannot** populate the validated-research cohort: missing immutable prior-time evidence and independent outcome provenance must be established separately. Normalizer unit tests and a report integration test cover this fail-closed policy. The conversion does not run SQL, fetch data, write to the database or enable signals.

## Research export field-coverage report (2026-10-29)

The local-file report now includes `evidenceCoverage` from the pure `exportEvidenceCoverage.mjs` analyzer. It counts rows with prior saved scores and dates, positive prices, later source prices/dates, asserted provenance flags, and explicit prior as-of timestamps. These are **field presence and caller assertion counts**, not independent proof of provider authenticity, historical as-of availability, licensing, or executable returns. The result always exposes `independentAuthenticationPerformed:false` and `independentlyAuthenticated:0`. Importantly, an ordinary SQL export intentionally has no prior as-of timestamp and therefore zero authenticated records; this is an expected safety outcome, not a reason to fabricate timestamps. Six unit tests cover this status and missing fields. No automated DB extraction, production writing, or notification activation was added.

## Actual production saved-data coverage inventory (2026-10-29, SELECT-only)

A read-only aggregate JOIN of `daily_stock_results` and `daily_result_price_provenance` confirmed: total saved rows **71,289**, rows with positive `price` and `next_price` **70,283**, rows with a linked price provenance entry **11,436**, rows both price-paired and linked **11,436**, and rows with `created_at::date` strictly earlier than the saved trade `date` **0**. Consequently **1,006** rows lack a positive price pair, **59,853** rows lack a linked provenance row, and **58,847** price-paired rows have no linked price provenance; linked coverage is **16.04%**. These categories overlap and must not be summed. The stored `created_at` is not timezone-qualified; same-day storage cannot demonstrate a valid pre-decision signal, nor does lack of prior-day `created_at` prove the information was unavailable elsewhere.

Added pure `dailyEvidenceCounts.mjs` with 8 regression tests to reconcile and guard the aggregate counts. **Neither linked provenance nor positive prices prove provider license, correct future trade date, immutable prior-day features, or executable returns.** No user-facing trade signal, source verification flags, extraction job, or production tables were changed.

## Retrospective data-use tiers (2026-10-29)

Added a pure offline three-tier classifier `researchUseTiers.mjs`. Positive paired saved prices without a linked source may be marked `referenceResearch` for **descriptive historical exploration only**. Missing/nonpositive prices or linked source requiring verification are marked `needsReview`. A record with all caller-asserted source and as-of fields may be marked `strictCandidate`, but **never** `strictVerified`: all output rows carry `independentlyVerified:false`. Neither source linkage nor caller flags authenticate market feed licensing, immutable decision-time evidence, or investment outcomes. This tiering is not applied to production tables or notifications. Nine regression tests added to CI. Actual 71,289-row production population has not been run through this new classifier; do not present hypothetical tier counts as measured.

## Production population research-use segmentation (2026-10-29, read-only)

A SQL SELECT joined saved daily results to their price-source provenance, explicitly treating NULL or nonpositive prices as invalid. Across **71,289** records, **58,847** have positive saved/next price pairs without linked source rows (`referenceResearch` under the current simplistic use-tier rules), while **12,442** require further review: **11,436** have linked provenance rows (all with positive price pairs), and **1,006** lack a valid price pair. Sum check: 58,847 + 12,442 = 71,289. A first draft SQL using `NOT (price > 0 ...)` failed to count NULLs; this corrected audit explicitly checks `IS NULL`. These are **SQL-derived categories mirroring limited observed fields**, not an execution of the JS classifier over 71,289 full records. The production query did not establish independent as-of evidence or outcome-provider authentication; **no verified strict-candidate count is claimed**. A linked-source entry alone is not independent verification, and reference-only prices are unsuitable for trading performance claims.

## Descriptive saved-price exploration batch (2026-10-29)

Added offline `savedPriceExploration.mjs` and manual file-only CLI `scripts/report-saved-price-exploration.mjs` to make the 58,847 reference-price observations potentially useful for **descriptive, retrospective analysis** without pretending to have decision-time provenance. The module measures saved-price next-observation returns by prior saved score (>=85 vs <85), equal-date gaps when both cohorts have at least ten rows, median and dispersion, clipping each observation at +/-5%, removing the three largest absolute date gaps, ex-post market regimes, and concentration of the high-score group's observation counts by code. Source rows can use SQL-style `prior_score`/`next_price`. It excludes duplicates, malformed dates, bad price pairs and missing prior scores. No provider authentication, trade signals or live notifications. This is not a trading strategy or validated predictive accuracy.

The companion command is `node scripts/report-saved-price-exploration.mjs ./approved-export.json`. It reads only an explicitly supplied local, approved JSON array, bounded by the existing parser. It reports usage tiers and the exploratory statistics together; the script does not fetch from databases or markets, persist results, or modify production. Added 26 unit tests and 9 end-to-end CLI-report tests, with the GitHub research CI workflow updated to cover both. Input may still be unsuitable for strong claims about exact trade outcomes. Do not conflate next saved observation with the next exchange trading day's close.

## Read-only monthly distribution of reference-only saved-price pairs (2026-10-29)

A production SELECT grouped the **58,847** historical price-paired rows without a linked price provenance record by saved `date` month. Results (month: rows, distinct codes, arithmetic mean of `100*(next_price/price-1)`, positive saved-price comparisons): 2026-06: 1,427 / 951 / -0.1635% / 167; 2026-07: 15,379 / 964 / +0.1269% / 7,822; 2026-08: 16,264 / 961 / +0.1967% / 8,596; 2026-09: 20,059 / 956 / -0.1726% / 8,804; 2026-10: 5,718 / 957 / -0.0189% / 2,693. Totals: 58,847 rows. Caution: first and last months may be partial coverage and next saved reference price need not mean next exchange-session price. These are **not** portfolio returns, execution results, licensed-feed verification, or predictive accuracy. The SQL read did not modify any data.

## Whole-population saved score drift by month (2026-10-29, read-only)

A separate production SELECT grouped all 71,289 saved daily rows by `left(date,7)` and averaged stored `score`: June 1,427 rows / mean 51.09; July 15,383 / 53.88; August 16,308 / 59.33; September 20,060 / 49.48; October 18,111 / 41.54. Totals sum to 71,289. These are stored score snapshots, not a stable or historically comparable version of AI POWER; scoring semantics and coverage can change. Do **not** interpret drift as changing market profitability or trading quality. Monthly sample counts are not equal and June/October coverage is partial. A separate planned prior-score-by-month return query could not be verified, so no new cross-month predictive gap is claimed. The query made no DB writes.

## Stored score >=85 by month (2026-10-29, read-only)

June: 67/1,427 (4.70%); July: 3,719/15,383 (24.18%); August: 5,127/16,308 (31.44%); September: 3,584/20,060 (17.87%); October: 1,563/18,111 (8.63%). This is a descriptive saved-score distribution, not a proof of changing market or model accuracy. Scoring definitions may differ by date. Added `savedScoreDrift.mjs` and 9 regression tests; research CI run #171 passed. No live signal changes.

## Month-by-month same-date prior-saved-score comparison (2026-10-29, read-only)

A retrospective SQL comparison of stored **previous** score >=85 versus <85, requiring at least 10 observations per cohort per date and equal weighting of eligible dates, found: June 1 comparable day / -0.1737 percentage points / high group won 0; July 11 days / -0.1140 pp / won 6; August 17 days / -0.1001 pp / won 7; September 21 days / -0.0096 pp / won 10; October 18 days / +0.3138 pp / won 11. These results used the full price-paired daily population, unlike the narrower reference-only subset; no prior-score availability timestamp or execution-price provenance was authenticated. October's positive average does not imply a stable predictive edge, given small date counts, month-dependent score distributions and prior retrospective testing. Added pure offline `monthlyPriorScoreComparison.mjs`, 11 regression tests, and CI coverage. This is NOT a prospective test or notification criterion.

## Frozen chronological saved-score research audit (2026-10-29)

Added `chronologicalScoreAudit.mjs` and 14 offline regression tests. The retrospective date split is fixed to 2026-09-02, with prior saved score threshold 85 and at least 10 observations per same-date score cohort. The function rejects malformed prices, duplicate code/date records and missing *caller-asserted* prior/outcome provenance. It reports separate earlier and later average daily high-minus-low return gaps but explicitly sets `prospectiveValidation:false` and `readyForSignals:false`. The input assertion flags themselves cannot authenticate external evidence and must never be set based solely on the existing unverified saved prices or later outcomes. This is a frozen **retrospective diagnostic**, not a preregistered prospective holdout or authorization to alter trading predictions. No connection to production or notifications.

## Frozen future-date shadow ledger (2026-10-29)

Added pure `prospectiveScoreLedger.mjs` and 20 regression cases. This ledger accepts only dates **strictly after 2026-10-29**, a saved prior score available before target day's JST midnight, a positive price pair and a claimed later outcome whose outcome trade date is after the target date and availability timestamp after target-day end. It forms high prior-score (>=85) and low-score (<85) cohorts and compares daily gaps only when each side has at least 10 rows. It reports date-by-date cohort counts, exclusions and descriptive gap statistics. An internal threshold of 20 comparable dates controls only the display status (`DESCRIPTIVE_SAMPLE_ACCUMULATED`), **never** acceptance as a validated strategy. Output always sets `independentlyAuthenticatedByFunction:false`, `signalEnabled:false`, `readyForTrading:false`. Caller-provided provenance flags are **not authenticated by the code**. No database hookup, scheduled extraction, notifications, or production changes were added. A genuine forward evaluation needs independently audited immutable as-of source timestamps and matured outcome sources, plus prospectively recorded eligibility and stable scoring semantics. Do not infer that any future cohort has actually been validated from these tests.

## Manual future shadow ledger command (2026-10-29)

Added `scripts/report-prospective-score-ledger.mjs`, backed by the frozen `prospectiveScoreLedger.mjs` engine. A developer can explicitly supply an approved local JSON array: `node scripts/report-prospective-score-ledger.mjs ./approved-file.json`. The local report never connects to production, fetches market data, schedules jobs, or enables alerts. The separate six-case report tests cover empty input, pre-freeze rows, unsupported future observations, malformed JSON, and attempted alert activation through input fields. Result status remains descriptive even after 20 comparable observation dates; code does not independently authenticate caller-provided source/provenance fields. No real forward cohort has been loaded through the new command in this PR.

## Saved outcome-source linkage audit (2026-10-29, production SELECT-only)

Inspected `app/lib/learning/checkDailyRunner.ts` and `app/lib/dailyLearning.ts`: source price comes from a later saved `daily_stock_results` row, while the checked historical target's `next_price`/`checked_at` is updated later; `daily_result_price_provenance` records the source row and source snapshot timestamp. This relationship does not establish that the old score was frozen ahead of the target trading day, nor that the source observation was an executable market close.

A separate read-only production join verified **11,436 linked outcome rows**, with **11,436 later source dates** and **11,436 linked source prices matching `next_price` within 0.000001 yen**. This checks link consistency but NOT independent feed authenticity, licensing, or decision-time feature availability. Added pure `savedOutcomeRelationAudit.mjs` with 12 offline tests of later source date, matching price, invalid and duplicate rows, and hard-disabled signal certification. No production data changes or alert activation.

## Saved-score as-of evidence audit (2026-10-29; SELECT-only)

Production `daily_stock_results` columns include `created_at` and `checked_at`, both `timestamp without time zone`. A SELECT measured 71,289 rows with `created_at`, all 71,289 with `created_at::date = date::date`, **zero** with a prior calendar date and 70,283 with a non-null `checked_at`. As stored, a same-date naive timestamp cannot establish that the score was independently frozen before a 09:05 decision, and it provides no timezone-qualified immutable external record. The retrospective score comparisons remain descriptive rather than verified predictive evidence. Added `savedScoreTimingAudit.mjs` plus 11 offline safety tests, including no-certification of caller attestation flags. No production modifications and no signal activation.

## Detached decision-time snapshot contract (2026-10-29)

Added research-only `detachedSnapshotContract.mjs` and 13 tests. The contract validates saved trade date/code, finite score, positive reference price, explicit-offset `capturedAt` strictly before 09:05 JST on the target date, provider/source ID and source version. It creates a deterministic SHA-256 digest over the canonical snapshot fields and exposes a tampering check. The digest detects modifications only relative to the supplied digest; **it is not proof that a provider actually supplied the quote at that instant, that an external third party witnessed the timestamp, or that the data were immutable in durable storage**. The detached contract does not read/write DB, attach to `saveDailyStocks`, automate capture, or enable signals. The design deliberately leaves `independentlyAuthenticated:false` and `usableForTrading:false`; a future pilot would need a permissioned append-only store and source attestation and must not overwrite historical data. CI checks the contract offline.

## Detached snapshot and later-outcome matching (2026-10-29)

Added pure, in-memory `detachedSnapshotReconciliation.mjs` with 12 offline regression tests and CI coverage. It verifies canonical snapshot digests, tracks duplicate snapshots versus conflicting snapshots for the same date/code, and joins independently supplied later source-price records to matching immutable-shape snapshot records. Matched retrospective percentage changes are strictly reference observations: no provider authentication, trusted timing authority, executable trading prices, durable append-only persistence, automatic outcome collection, or application signal activation is supplied. No database modification, deployment or notifications. The module reports `persisted:false` and `acceptedForTrading:false` unconditionally. Before any future use beyond detached research, source identifiers, canonical date schema, outcome completeness, and tamper-evident external storage must be verified separately.

## Explicit local append-only hash-chain trial (2026-10-29)

Added `localSnapshotLedger.mjs` and 13 offline regression tests. This is a **manual local JSONL prototype**, not a production persistence feature. It checks detached snapshots' SHA-256 digests, identifies duplicate date/code pairs, appends records with a previous-record digest and flushes an explicitly named local file, then validates the chain on read. An auxiliary `scripts/inspect-local-snapshot-ledger.mjs <local-ledger.jsonl>` command reports integrity without writing. No database credentials, server route, scheduled job, notifications or deployment were introduced. Crucially, a local hash chain is **not truly immutable**: a party with file write access can truncate or rewrite and recompute the chain. Independent off-machine head anchoring, trusted timestamp, source attestation, access policy and backup are still absent. No forward data have been captured in this prototype; `signalEnabled` is false.

## Retained checkpoint verification (2026-10-29)

Added offline `ledgerCheckpoint.mjs` and 11 regression tests. A checkpoint records hash-chain head, record count and an explicitly supplied timestamp; later verification checks that the retained prefix still matches and detects truncation or rewriting against a **separately preserved** checkpoint. The module never claims to have published that checkpoint, authenticated an external witness, or acquired a trusted timestamp: `externallyWitnessed:false` and `externallyAuthenticated:false` are fixed. This is only a building block for an independent audit trail and has no production database, storage connector, scheduled task or trading notification integration. A caller-controlled timestamp is not a trusted time source, and copying the checkpoint alongside a mutable ledger does not prevent coordinated rewriting.

## Offline end-to-end local research batch (2026-10-29)

Added `offlineResearchBatch.mjs` and a manual `scripts/report-local-research-batch.mjs ledger.jsonl outcomes.json [checkpoint.json]` command. It reads previously created detached snapshots from a JSONL hash-chain, verifies structural integrity and an optional separately retained checkpoint, reconciles caller-supplied later outcomes, and reports descriptive average, median and positive rate. Invalid or truncated chains abort with a fail-closed result, and the manual CLI returns a nonzero exit status when that happens. Added 11 full-pipeline offline tests and extended the research CI. The command performs no database writes or fetches, and does not create actual forward snapshots. The price ratios are historical references only; `providerVerified:false`, `externalTimestampVerified:false`, `signalEnabled:false`, `readyForTrading:false`. The checkpoint cannot establish trusted capture time or independent price source authenticity.

## Deduplication and calendar validation for local outcome reconciliation (2026-10-29)

The offline `detachedSnapshotReconciliation.mjs` now validates real Gregorian dates, ticker format, and a later source trade date. Multiple outcome rows sharing the same target trade date and code are counted once: additional records increment `duplicateOutcomes` rather than inflating reference observations or return statistics. Five new regression tests cover invalid February/end-of-month dates, malformed tickers, and repeated or conflicting outcome entries. This remains a local retrospective reference calculation without independent market/provider authentication; production DB and notifications are unchanged.

## Historical export timestamp metadata propagation (2026-10-29)

Extended the existing manual read-only SQL export template to include `daily_result_price_provenance.source_snapshot_created_at`; the offline daily export normalizer now exposes it as `sourceSnapshotCreatedAt`. This field refers to the **later outcome price's source observation**, not the earlier AI decision's as-of time. It is descriptive data and must never set `priorEvidenceVerified`, `outcomeProvenanceVerified`, or `priorAvailableAt` to trusted values: the normalizer intentionally leaves them false/false/null. Two additional tests enforce the export and normalization behavior. No historical data was backfilled into pre-09:05 snapshots, and no production writes or trading signals were added.

## Current saved score / later reference return cross-section (2026-10-29; SELECT only)

A read-only aggregate of daily rows with strictly positive `price` and `next_price` covered **71,236** observations. By saved month, mean `100*(next_price/price-1)` for current saved score >=85 versus <85: June (67 / 1,360): 0.0000% versus -0.1715%; July (3,719 / 11,660): +0.1823% versus +0.1092%; August (5,104 / 11,160): +0.1255% versus +0.2293%; September (3,584 / 16,475): -0.3862% versus -0.1261%; October (1,561 / 16,546): -0.0957% versus -0.1198%. Monthly totals 1,427 / 15,379 / 16,264 / 20,059 / 18,107. The high-score group does not uniformly outperform. This is a **same-record score** comparison, not the independently as-of verified previous-score, equal-day weighted comparison elsewhere in this document. Each stock-day has equal weight within its month; no execution, fee, volatility, or prospective authenticity adjustment was made. May not represent executable future returns. Do not enable signals based on this descriptive result.

## Same-date current saved-score equal-day comparison (2026-10-29; SELECT only)

A read-only production SQL grouped strictly positive `price`/`next_price` rows by saved date, comparing score >=85 versus <85 within each date when both groups had >=10 rows, and then equally weighted the eligible date gaps by month. June: 1 day, +0.0000 pp, high group won 0; July: 11 days, -0.1941 pp, won 4; August: 17 days, -0.0820 pp, won 7; September: 21 days, -0.0873 pp, won 10; October: 19 days, -0.0545 pp, won 10. This contrasts with the earlier observation-weighted monthly comparison, where July and October high-score means were relatively higher. The difference emphasizes date composition and weighting sensitivity, not alpha. This uses **same-record scores**, not independently timestamp-verified previous scores. No model recommendation or signal changes are warranted.

## Outlier sensitivity of same-date saved-score comparisons (2026-10-29, SELECT-only)

In the same-record saved-score >=85 versus <85 daily comparison (each cohort >=10 per date), **69 dates** were comparable. The equally weighted mean high-minus-low gap across all dates was **-0.0927 percentage points**, with the high-score cohort higher on **31/69 dates**. Dropping the **three largest absolute daily gaps** (chosen retrospectively for sensitivity analysis, not a deployable rule) changed the mean to **-0.0645 pp**. The mean remained negative. This is a descriptive robustness check: saved scores, data-provider entitlement, true decision-time as-of, and executable price outcomes have not been independently authenticated. No threshold, notice, production code or trading recommendation was changed.

## Median check on same-date score cohort gap (2026-10-29; SELECT-only)

A further independently run read-only aggregate confirmed 69 eligible dates (both saved-score cohorts >=10 entries), mean high-minus-low **-0.0927 percentage points**, **median -0.0285 pp**, and high-score group outperforming on **31/69** dates (44.9%). Mean and median are negative. This is a same-record historical reference comparison and not evidence of score availability before decision time or executable returns; no production rollout is justified.

## Post-hoc market-regime sensitivity (2026-10-29; SELECT only)

Of 69 same-date comparable observations (>=10 saved-score >=85 and >=10 <85 on each date), classified days by **the same universe's subsequently observed average reference return**, NOT by pre-decision observable TOPIX/Nikkei: market average below -0.1% (22 dates) had equal-day high-minus-low mean **+0.0298 pp**, median +0.0656 pp and high cohort won 11/22; market average -0.1% through +0.1% (14 dates) had mean **-0.1627 pp**, median -0.0001 pp, wins 5/14; market average >+0.1% (33 dates) had mean **-0.1447 pp**, median -0.0945 pp, wins 15/33. Crucial **look-ahead leakage warning**: regime classification uses subsequent returns and therefore CANNOT be used as an ex-ante feature, nor does it validate a strategy. No production AI score, threshold, signal or notification changes.

## Preopen market snapshots existence audit (2026-10-29, SELECT-only)

A read-only inspection of `public.morning_market_forward_runs` found 7 `COMPLETE` rows dated 2026-10-21, 22, 23, 26, 27, 28 and 29. All have timezone-aware `captured_at` timestamps approximately 08:45:09–08:45:11 Asia/Tokyo, earlier than 09:05 JST on their trade dates. The policy was `PREOPEN_US_FX_GAP_V1`; the recorded source was `Yahoo Finance daily chart`; PTS was `UNAVAILABLE` for all 7. The `quotes` JSON contains `dow`, `nasdaq`, and `usdJpy` keys on all 7 days. This provides a candidate historically recorded **preopen US/FX market context**, not contemporaneous Japanese TOPIX/Nikkei and not proof that each underlying quote was published and licensed prior to capture. Before relying on these as ex-ante features, independently verify the individual quote observation times, provider license, and completeness. **Only seven dates** currently exist and no predictive validation or AI score activation is justified. No production writes made.

## Preopen US/FX snapshots joined to daily outcomes (2026-10-29; SELECT-only)

Read-only join of `morning_market_forward_runs.trade_date` to `daily_stock_results.date`: 7 dates x 953 score rows, but **only 6 dates x 953 = 5,718** rows had both positive `price` and `next_price`; 2026-10-29 had 953 score rows but zero completed valid outcome pairs, so excluded from performance results. The six completed days' high-score (`score >= 85`) versus low-score (`<85`) reference means were: Oct21 (51 high) +1.1869% / -0.6954%; Oct22 (62 high) -0.5684% / -0.5216%; Oct23 (50 high) -0.8925% / +0.3850%; Oct26 (56 high) -0.4796% / +0.1002%; Oct27 (29 high) -1.0438% / -0.2390%; Oct28 (27 high) -0.9503% / -0.4814%. High-score group exceeded low-score group on only **1 of 6** complete dates. The preopen `quotes` have `dow`, `nasdaq`, `usdJpy` data with nested `state:REFERENCE`, `changePct`, `quoteDate`, and `sourceTimestamp` fields; source timestamps should be independently checked for provider availability/market session semantics before any historical feature acceptance. In particular, quoted timestamp earlier than the 08:45 capture is not by itself sufficient verification. Extremely small date sample, no trading costs, no predecision score attestation, no causal evidence; don't deploy conditional rules or notifications based on this. Production DB used read-only.

## Preopen market JSON and same-date stock-result join (2026-10-29, SELECT-only)

Inspected all seven `morning_market_forward_runs.quotes` entries: each `dow`, `nasdaq` and `usdJpy` value has `price`, `changePct`, `quoteDate`, `sourceTimestamp` and `state: REFERENCE`. They are **reference** market quotes, not independently authenticated live observations. All seven morning records have matching 953 daily stock rows, giving 6,671 stock-day rows. Valid positive saved `price`/`next_price` pairs by trade date: Oct 21: 953 (mean -0.5947%); Oct 22: 953 (-0.5246%); Oct 23: 953 (+0.3179%); Oct 26: 953 (+0.0661%); Oct 27: 953 (-0.2635%); Oct 28: 953 (-0.4946%); Oct 29: **zero** (outcome still incomplete). Thus 5,718 historical price pairs across six dates, not seven validated forward dates. The Dow quoteDate was the preceding calendar/trading date for all seven; FX quoteDate was the same trade date on Oct 21/22/23/26 but one day earlier on Oct 27/28/29. This mixed dating must be audited against the provider's observation-time semantics **before** deriving an ex-ante feature. The sourceTimestamp fields alone do not establish provider availability or rights. No predictive condition approved; no production writes or notification changes.

## Six-day preopen US/FX source-age and saved-score outcome audit (2026-10-29; SELECT-only)

Using seven stored preopen rows, the recorded FX `sourceTimestamp` was ~0.75 hours before 08:45 capture on Oct 21–23, ~0 hours on Oct 26, and **~23.75 hours** on Oct 27–29. Dow source timestamp was ~10.25 hours before capture on normal weekdays and ~58.25 hours on Monday Oct 26. These are arithmetic ages of *claimed reference timestamps*; provider availability, observation-time meaning and entitlement are NOT independently confirmed. A new pure `preopenReferenceAgeAudit.mjs` compares all three reference source timestamps against capture and fails closed on missing, future or over-age references; default maximum age 12 hours is a conservative research example, not a verified policy, and would reject some legitimate weekend closes. This module is not wired into any production market capture, signal or notifications.

Saved same-record score >=85 versus <85 reference returns on dates with later outcome pairs: Oct 21 +1.1869% vs -0.6954% (51 vs 902); Oct 22 -0.5684% vs -0.5216% (62 vs 891); Oct 23 -0.8925% vs +0.3850% (50 vs 903); Oct 26 -0.4796% vs +0.1002% (56 vs 897); Oct 27 -1.0438% vs -0.2390% (29 vs 924); Oct 28 -0.9503% vs -0.4814% (27 vs 926). High-score group outperformed on **one of six dates** only. Oct 29 has no later saved outcome pairs. These 5,718 stock-day price pairs are clustered within just six dates, not 5,718 independent market days; no predictive or trading claims.

## Instrument-specific stale-quote age audit (2026-10-29)

The offline `auditPreopenMarketReference` now accepts optional explicit `maximumAgeByInstrument` overrides (for `dow`, `nasdaq`, `usdJpy`) while keeping the 12-hour illustrative default. A US index Friday reference on Monday can be tested with a longer **research-only** age window, while a stale FX timestamp is still independently rejected. Four additional tests verify these cases and malformed overrides. These windows are analyst inputs, not an approved market calendar, independent publication-time proof, or permission to enable signals. For robust production-quality timing, each source needs trading calendar and provider quote-time semantics, plus source/license verification. The module remains disconnected from market capture and production.

## Weekend-only preopen market reference policy (2026-10-29)

Added offline `preopenWeekendPolicy.mjs`: for a Monday **JST** capture, only `dow` and `nasdaq` whose claimed source timestamps fall on Friday **UTC** may receive an explicit 72-hour weekend-age window; `usdJpy` always retains the independently configured 12-hour example freshness window. Missing, future, Thursday and Tuesday source scenarios are rejected by the existing age check. Eight regression tests exercise weekend and FX separation. This is a **research heuristic**, not an authoritative US exchange holiday calendar: the Friday UTC check can misclassify instrument timestamps and cannot prove publication, observation time, provider licensing or availability. `calendarVerified`, `providerVerified` and `signalEnabled` remain false. No production integration or deployment.

## FX source-age cohort versus score gap (2026-10-29; SELECT-only)

Joined seven morning preopen snapshots by `trade_date` to saved daily-price outcomes; Oct 29 had no valid outcome pairs, leaving six evaluated dates, 953 stock-day price pairs each. Quoted USD/JPY source age versus same-record score >=85-minus-<85 average reference-return gap (percentage points): Oct 21 (0.75h, +1.8823), Oct 22 (0.75h, -0.0468), Oct 23 (0.75h, -1.2775), Oct 26 (~0h, -0.5798), Oct 27 (23.75h, -0.8047), Oct 28 (23.75h, -0.4690). Equal-date mean gap for age <=12h: **-0.0055 pp on four dates**; for age >12h: **-0.6369 pp on two dates**. This is strictly an exploratory post-hoc comparison of claimed timestamp age, not a demonstration that stale FX prices cause poor score performance; the days differ in many confounders and no independent provider timestamp attestation exists. The 12-hour cutoff is experimental; no model tuning, notifications, or live deployment permitted on this evidence.

## Sensitivity: FX reference-age cohort is dominated by one day (2026-10-29, SELECT-only)

Recomputed from the saved morning FX source timestamps and same-date score cohort mean-return gaps using a read-only SQL query: source age <=12h has four dates, **mean -0.0054 pp**, **median -0.3133 pp**, minimum -1.2775 pp, maximum +1.8823 pp. Source age >12h has two dates, **mean and median -0.6369 pp**, range -0.8047 to -0.4690 pp. The earlier approximate fresh mean of -0.0055 pp reflected averaging previously rounded daily display values; the direct SQL aggregate provides -0.0054 pp. Removing Oct 21 (+1.8823 pp) from the <=12h cohort gives approximately **-0.6347 pp across only three dates**, almost indistinguishable from the older-source cohort -0.6369 pp. This is a post-hoc sensitivity illustration, not a planned exclusion policy or evidence of any causal freshness effect. Pretrade availability, provider timestamps, and actual trade returns remain unverified. **Do not enable a 12-hour score adjustment or related notification.**

## Alternative market-learning data cannot fill preopen history (2026-10-29; SELECT-only)

A read-only `market_learning_logs` check found 73 entries with `trade_date` from 2026-07-03 through 2026-10-29, but **zero** `created_at` before 09:05 JST on the corresponding trade date. The separate `morning_market_forward_runs` table still contains only 7 preopen records dated 2026-10-21 through 2026-10-29. The Oct 29 `daily_stock_results` cohort contains 953 rows but **0** positive paired next prices. Hence historical market-learning logs must not be retroactively relabeled as contemporaneously available 09:05 market features, and Oct 29 must remain outcome-pending. A longer history of after-the-fact records does not extend the number of authenticated morning decision dates. Remain shadow-only; do not activate score/notification adjustments.

## Automatic offline preopen research date partition (2026-10-29)

Added pure `preopenResearchPartition.mjs` with 11 regression tests and CI. It groups caller-supplied day records, rejects invalid/duplicate dates and 08:45 capture timestamps on the wrong JST date, and applies the separate weekend-aware US index versus FX source-age research checks. It returns `AGE_SCREEN_ONLY`, `EXCLUDE_CAPTURE_DATE` or `EXCLUDE_SOURCE_AGE` with counts and per-quote reasons. Crucially `AGE_SCREEN_ONLY` means only internal time/date screening passed, **not** verified availability, provider rights or predictive usefulness; `authenticatedForPrediction:0` and `approvedForSignals:0` are always fixed. The module does not fetch/store real market data and is not wired to production, so results of the existing 7 days cannot yet be asserted from running it on live data. It is a reusable gate for explicitly exported candidate snapshots.

## Real DB timestamptz adapter and seven-date screening (2026-10-29)

Actual read-only DB rows format `captured_at` such as `2026-10-25 23:45:10.053+00`, whereas the offline partition expects explicit-offset ISO 8601. `preopenDbAdapter.mjs` now converts the PostgreSQL text display (including +00/+0900) to an explicitly offset timestamp and rejects naive timestamps. Nine tests include the Oct 26 Monday shape and integrate with the existing partition. Applying the existing **illustrative** 12h weekday / 72h Monday Friday-US-index policy to the seven recorded timestamp values suggests **four AGE_SCREEN_ONLY days (Oct 21, 22, 23, 26)** and **three FX-stale exclusions (Oct 27, 28, 29)**; this last classification is derived from inspected saved timestamps and is **not an executed live import of all seven records into the module**. AGE_SCREEN_ONLY does not mean provider-authenticated evidence or usable prediction data. No live system writes or signals.

## Seven-date DB timestamp fixture integration verification (2026-10-29)

Executed the read-only SELECT for all seven `morning_market_forward_runs` rows and transcribed their actual captured-at and index/FX source timestamps into `tests/preopen-seven-date-db-fixture.test.mjs` (timestamp-only, no price payload). The offline test runs the exact `adaptPreopenDbRows` -> `classifyPreopenResearchDates` pipeline and asserts: 7 records, **4 `AGE_SCREEN_ONLY`** dates (Oct 21, 22, 23, 26), **3 `EXCLUDE_SOURCE_AGE`** dates (Oct 27, 28, 29, each `usdJpy:STALE_REFERENCE`), zero duplicate dates, and zero capture-date mismatches. Three new integration assertions were incorporated into the CI; **CI #353 succeeded** at code/CI commit `022818f89a44c5773d1b5a4844c4f87a2e32e710`. This is a fixed snapshot fixture sourced from actual SELECT results, not a live production DB import executed by CI. Classification is structural only, not source authentication, ex-ante proof, or signal approval. No production write or change.

## Seven saved preopen timestamps exercised through real offline partition code (2026-10-29)

A reproducible integration-style fixture `tests/preopen-seven-real-timestamps.test.mjs` records the **seven timestamp sets observed via production read-only SELECT** (trade date, PostgreSQL `captured_at` text, Dow/Nasdaq source timestamp and FX source timestamp). The test invokes the real `adaptPreopenDbRows` and `classifyPreopenResearchDates` functions, instead of extrapolating results manually. **CI run #363 passed**: 4 dates `AGE_SCREEN_ONLY` (Oct 21, 22, 23, 26) and 3 dates `EXCLUDE_SOURCE_AGE` with `usdJpy:STALE_REFERENCE` (Oct 27, 28, 29); no duplicate or capture-date mismatch. This tests a frozen transcription of real source timestamps, **not** a runtime connection to Supabase and **not** independently authenticated quote availability. `authenticatedForPrediction=0` and `approvedForSignals=0`. This is not a backtest of investment returns, nor evidence to enable any live score filter.

## Seven observed preopen timestamps end-to-end regression (2026-10-29)

Added `tests/preopen-seven-real-timestamps.test.mjs`, with seven **transcribed timestamp-only fixtures** from read-only `morning_market_forward_runs` rows. The test passes these through `adaptPreopenDbRows` and `classifyPreopenResearchDates` and asserts four `AGE_SCREEN_ONLY` days (Oct 21/22/23/26), three `EXCLUDE_SOURCE_AGE` days due to `usdJpy:STALE_REFERENCE` (Oct 27/28/29), and no capture-date mismatch. GitHub research CI run **#363 succeeded** on commit `45da311cbb12c6713c8e1af7bd06069e21422c24`. This validates the *fixed historical fixture against the offline implementation*; it does **not** represent direct live DB-to-research-code integration or independently authenticate quote timestamps, sources, licensing, or predictive value. No production writes, model rollout or notification changes.

## Manual exported JSON to preopen classification (2026-10-29)

Added `scripts/report-preopen-json-export.mjs approved-preopen-rows.json`: a **manual**, local read-only CLI accepting a JSON array whose objects use the already inspected `trade_date`, PostgreSQL-text `captured_at`, and `quotes` fields. It adapts timestamps and applies `classifyPreopenResearchDates` to output per-day reason codes, totals, and explicitly unverified source/trading statuses. The input is capped at 5 MiB; malformed and non-array JSON is rejected. Eight offline tests cover valid classification, stale USD/JPY, duplicates, empty and malformed input and size limits. The command has **no live Supabase connection**, writes no DB records, does not request any secrets, and makes no predictive or live trading decision. A manually approved export remains necessary; historical snapshot fixture tests are separate from production queries.

## Bounded, manual JSON SQL export contract (2026-10-29)

Added `preopenJsonExportSql.mjs` and eight offline tests for a non-executing SELECT-only template. The SQL yields one JSON array containing `trade_date`, timezone-bearing `captured_at` text and `quotes` from `morning_market_forward_runs`, bounded to 2026-10-21 through 2026-10-29 and at most 100 rows. An authorized operator may export the resulting `approved_preopen_rows` JSON array to a local file, then invoke `node scripts/report-preopen-json-export.mjs approved-preopen-rows.json`; the command never connects to Supabase. The date window is intentionally a reviewed example, **not an unattended ongoing export**. This does not certify provider quote timestamps or licensing, nor does it modify production or emit buy signals.

## SQL export contract exercised against live stored records (2026-10-29, read-only)

Executed the bounded `SELECT` SQL against `morning_market_forward_runs`: returned **7 rows**, 2026-10-21 through 2026-10-29. The result is exposed as a single `approved_preopen_rows` JSON object field, rather than a bare top-level JSON array; therefore the offline manual report now accepts either a bare array or exactly `{\"approved_preopen_rows\":[...]}`. Added validation tests for this documented wrapper. The data returned confirms source timestamps previously transcribed in seven-row regression fixtures; **the actual export has not been transferred directly into the Node CLI in this session**, so do not present that as an end-to-end live-input CLI run. Quote origin, timestamp semantics and licensing remain unverified. No production writes or signal changes.

## Preopen versus later outcome: fail-closed coverage join (2026-10-29)

READ-ONLY matched 7 preopen dates to `daily_stock_results`: Oct 21–28 each have 953 positive price/next-price pairs, while Oct 29 has **0**, despite 953 saved rows. Added pure `preopenOutcomeJoin.mjs` and six tests: a source-age excluded day cannot be reaccepted because later outcomes exist, a screened day with missing/inconsistent outcome cohorts stays `OUTCOME_INCOMPLETE`, and each day contributes once rather than counting 953 correlated stocks as independent trading days. Outputs explicitly set `modelTrainingAllowed`, `notificationAllowed`, and `exAnteVerified` to false. This is a descriptive coverage join, not a validated trading or score-improvement backtest. Future-date and independently authenticated predecision feature evidence are still missing.

## Saved score timestamp ambiguity gate (2026-10-29)

Read-only inspection confirms `daily_stock_results.created_at` and `checked_at` are PostgreSQL `timestamp without time zone`; they do not independently establish UTC/JST instants. Across Oct 21–29, each day's 953 rows show saved creation time around `06:35`, with later outcome checks for Oct 21–28 and no checks on Oct 29. Do **not** assume `06:35` is before a 09:05 JST decision. Added `scoreDecisionTimeGate.mjs` and seven regression cases: reject ambiguous timestamp types, reject explicitly post-decision origin times, and label plausible explicitly zoned times unverified without independent provider / immutability proof. CI run #448 succeeded on code/test commit `c317b87`. No production signal usage or approved score performance claims follow from this check.
