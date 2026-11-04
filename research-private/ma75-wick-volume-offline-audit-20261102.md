# MA75 wick/volume offline audit — 2026-11-02
Status: **SHADOW_NOT_APPROVED**. Source: read-only query of 130 `public.display_snapshots` daily chart entries with `dataSource=yahoo_chart`, using bars strictly earlier than Unix 1793577600. This is a convenience sample, NOT the complete TSE universe. Capture timestamps, corporate-action adjustments, full gap/chronology checks and fillability have NOT been independently audited.

Signal (prior-information-only): 75-day close SMA crosses upward, upper-wick fraction >=0.35, signal volume >=1.5x previous 20-day average. Entry assumed following session open +0.1%, exit session +5 close -0.1%; no execution proof.

| Code | Signal date | Wick % | Volume multiple | Cost /100 shares ¥ | 5-session hypothetical return % |
|---|---|---:|---:|---:|---:|
| 4401 | 2026-08-05 | 43.62 | 1.57 | 406806 | +15.885 |
| 5805 | 2026-08-10 | 38.78 | 2.31 | 270871 | +8.430 |
| 7775 | 2026-08-14 | 37.50 | 3.90 | 43443 | -2.039 |
| 6088 | 2026-09-08 | 40.00 | 1.73 | 55255 | +3.416 |
| 6264 | 2026-10-05 | 46.55 | 1.53 | 225025 | +0.999 |
| 7775 | 2026-10-09 | 48.15 | 8.40 | 42442 | PENDING / unavailable |
| 4187 | 2026-10-13 | 36.92 | 4.08 | 521521 | PENDING / unavailable |

Five observed outcomes: arithmetic mean +5.3382%, positive fraction 4/5 (80%). **Not predictive**: small sample, post-hoc selection, stale/missing outcome bars, chart selection bias. Do not present 80% as prospective win probability.

100-share lot budget ¥100k–¥500k: feasible lot ranges for observed outcomes are 4401 1–1; 5805 1–1; 7775 3–11; 6088 2–9; 6264 1–2. 4187 exceeds budget even at 100 shares. These are illustrative at hypothetical entry costs, not orders.

Before promotion: (1) verify historical acquisition as-of and bar adjustment; (2) run local Node tests/CI; (3) audit OHLCV chronology, extreme open/close gaps and flat bars; (4) validate actual execution assumptions; (5) obtain complete point-in-time market universe and untouched forward sample; (6) compare all baselines, regimes and multiple-testing corrections; (7) record risk, drawdown and turnover; (8) separate production approval.

No production changes, notifications, trading or additional services are authorized.

Gemini comparison set 6158, 5216, 4074, 3839: none has a matching `chart:<code>:1D` entry in the current 130 saved daily snapshots. Therefore the four cannot be classified from this source; absence is not a negative signal.

## Additional read-only quality audit (2026-11-02)
Across six codes 4187, 4401, 5805, 6088, 6264, 7775, inspected 731 stored bars (five codes with 122 each and 6264 with 121): invalid OHLCV 0, duplicate bar timestamps 0, flat high=low bars 0, >45% opening or closing gaps versus previous close 0. This is a basic series-level check, not proof of corporate-action adjustments, source timing, or fillability.
Missing outcomes are explained by stale saved charts: 7775 latest stored pre-Nov-2 bar is 2026-10-14, 4187 latest is 2026-10-15. Do not classify them as winners or losers. Refresh must be separately authorized and verified without extra cost; do not overwrite production data as part of this research.

## Data freshness follow-up
Read-only database metadata confirms `chart:7775:1D` last updated at 2026-10-14 19:51:46 UTC and `chart:4187:1D` at 2026-10-15 10:53:59 UTC. Their saved chart series therefore cannot provide the five-session outcomes for 2026-10-09 and 2026-10-13 signals, respectively. This is a **coverage gap**, not evidence of positive or negative performance. No data refresh or paid API call performed.

Offline evaluator updated to expose observed session count, losing and zero-return counts, and min/max hypothetical returns. Test source added but CI execution remains unverified. No production changes.

## Flat OHLC bar investigation (read-only)
The 12 high=low bars across 8 symbols are: 3361 (2, volume 100–200), 3909 (1, volume 670200), 4436 (3, volume 34400–63700), 4493 (1, volume 407200), 6866 (1, volume 51800), 6925 (1, volume 236500), 6966 (1, volume 552500), 8848 (2, volume 506000–758700). A flat OHLC bar with substantial recorded volume can reflect price-limit trading or data representation and is not automatically a zero-volume bar or corruption. Investigate exchange halts/limits, adjusted prices, timestamp and vendor semantics before classification. None of these eight codes is among the six codes producing the seven provisional MA75 signals; this does not rule out effects on universe-wide baseline comparisons.

## Flat-bar sensitivity comparison
Read-only SQL on the 130 cached daily series: baseline 7 candidate signals, 5 available modeled five-session outcomes, mean +5.338%, positive fraction 80%. After excluding **all eight symbols** containing any of the 12 high=low bars: **7 signals, 5 outcomes, +5.338%, 80%** (unchanged). This is an entire-symbol exclusion sensitivity analysis, not a validation of the flat bars themselves. Same sample selection bias, stale outcome data, execution uncertainty and no prospective validation apply.

## Comparative baseline audit (2026-11-02, read-only)
Same 130 cached daily chart series, hypothetical entry at next session open and exit at signal+5 session close, 0.1% friction each side, requiring available entry and exit bars. Four **mutually exclusive** cohorts:

| Cohort | N | Mean return % | Positive % | Worst % | Best % |
|---|---:|---:|---:|---:|---:|
| All 3: MA75 upward cross, wick>=35%, volume>=1.5x | 5 | 5.338 | 80.00 | -2.039 | 15.885 |
| MA75 cross, not both other conditions | 161 | 0.165 | 53.42 | -17.270 | 22.391 |
| Wick+volume, no MA75 cross | 139 | 1.223 | 54.68 | -14.238 | 33.669 |
| Remaining bars | 5140 | 0.753 | 53.52 | -23.563 | 159.670 |

**Interpretation limits:** Unequal group sizes; only five complete triple-condition outcomes; overlapping rolling five-session outcomes and repeated stocks; no market/regime adjustment; no bootstrap uncertainty; price adjustment/corporate actions unverified; no real fills. 'OTHER' includes extreme positive outliers (+159.670%). These comparisons are exploratory and cannot justify a production alert. All counts are event rows, not unique stocks or independent trials.

## Month-by-month audit (read-only, completed outcomes only)
2026-08: N=3, mean +7.425%, range -2.039% to +15.885%; 2026-09: N=1, +3.416%; 2026-10: N=1, +0.999%. Two further October signals have no complete five-session outcomes in cached snapshots and are **not** included. The monthly apparent decline cannot establish trend deterioration with N=1 in September and October. August dominates the overall +5.338% average.

## Leave-out sensitivity (2026-11-02 read-only)
Completed hypothetical 5-session outcomes: all N=5 mean +5.338%; excluding August N=2 mean +2.208%; excluding best single outcome N=4 mean +2.701%; excluding worst single outcome N=4 mean +7.183%. This is exploratory sensitivity only; N=2–5 is inadequate for a stable predictive expectation. Do not promote into production based on these numbers.

## Benchmark availability audit (2026-11-02, read-only)
No daily chart snapshots matching N225, TOPIX, 225, 1306 or 1321. public.market_learning_logs has 75 rows dated 2026-07-03 through 2026-11-02, but zero positive Nikkei values and zero positive TOPIX values. Consequently no same-horizon benchmark excess return is calculated or claimed. The table schema contains nikkei and topix numeric columns, but they are not populated in these records. A separately sourced, timestamped, price-adjustment-consistent benchmark series is required; avoid backfilling unverified data.

## Same-month internal-universe comparison (2026-11-02, read-only)
Compared five completed triple-condition events against all other eligible cached stock-date rows in the **same calendar month**, using identical next-open to fifth-close hypothetical returns and 0.1% friction per side. This is NOT a Nikkei/TOPIX benchmark or a date-matched control.

| Month | Triple signal N / mean % / positive % | Other eligible N / mean % / positive % | Mean difference, pp |
|---|---|---|---:|
| 2026-08 | 3 / +7.425 / 66.67 | 2123 / -0.344 / 47.90 | +7.769 |
| 2026-09 | 1 / +3.416 / 100 | 2461 / +1.196 / 54.82 | +2.220 |
| 2026-10 | 1 / +0.999 / 100 | 848 / +2.204 / 64.15 | -1.205 |

October underperforms its same-month comparison despite a positive absolute modeled return. Event rows overlap within and between symbols; group composition and sample availability differ by month. No causal edge or live trading readiness inferred. Next: date-matched and sector/liquidity matched controls, independent benchmark OHLC, and forward data.

## Same-day price/volume matched internal controls (read-only)
For each of five completed MA75+wick+volume events, controls are other cached symbols on the **same timestamp**, not themselves triple-signals, with closing price between 0.5x and 2x the target and signal-day volume between 0.25x and 4x target. Each modeled return uses next-session open to fifth-session close with 0.1% friction per side. Controls are unweighted within each target.

| Signal date | Code | Signal % | Control count | Control mean % | Signal minus controls, pp |
|---|---|---:|---:|---:|---:|
| 2026-08-05 | 4401 | 15.885 | 30 | -1.086 | +16.972 |
| 2026-08-10 | 5805 | 8.430 | 13 | -1.945 | +10.376 |
| 2026-08-14 | 7775 | -2.039 | 5 | +1.725 | -3.765 |
| 2026-09-08 | 6088 | +3.416 | 8 | +3.823 | -0.406 |
| 2026-10-05 | 6264 | +0.999 | 38 | +3.763 | -2.764 |

Only **2/5** signal events outperform their matched control mean, despite **4/5** positive absolute returns. Price and share-volume matching does not ensure equal liquidity, market capitalization, sector, beta, volatility, or spread. These are exploratory historical comparisons, not independent randomized controls or proof of alpha. Preserve SHADOW_NOT_APPROVED; no production notifications.

## Aggregate matched-control sensitivity (read-only)
Five completed signal events, equal weight per signal (not per control row): signal mean +5.338%; average of the five control-group means +1.256%; mean signal-minus-control +4.082 percentage points; **median excess -0.406 percentage points**; signal outperforms matched-control mean in only **2/5** cases; excluding the three August signals, mean excess **-1.585 percentage points** (N=2). The mean advantage is driven by the two large August relative winners and is not a stable cross-period effect. No evidence of live-tradable alpha, no notification or production approval.

## Tail-frequency audit (read-only, five completed observations)
Hypothetical five-session net returns: >=+5%: 2/5; >=+10%: 1/5; <=-5%: 0/5; minimum -2.039%; maximum +15.885%. Same-day price/volume matched relative returns: minimum -3.765 pp, maximum +16.972 pp, sample standard deviation 9.150 pp. Small sample; absence of a large observed loss is not a risk guarantee. No intrahold maximum adverse excursion, real fills, or independent forward validation yet. Production and notifications remain disabled.

## Intrahold daily-low adverse excursion audit (2026-11-02, read-only)
For the five completed triple-condition signals, use the next trading session OPEN as hypothetical entry and the MINIMUM daily LOW from sessions +1 through +5 as the worst observed price relative to entry. This is entry-relative adverse excursion, **not** peak-to-trough drawdown and not a stop-order fill simulation. Five-session net return includes 0.1% friction per side; daily-low excursions exclude friction.

| Code | Signal date | Final 5-session net % | Lowest low vs entry % | Highest high vs entry % |
|---|---|---:|---:|---:|
| 4401 | 2026-08-05 | +15.885 | -0.098 | +20.891 |
| 5805 | 2026-08-10 | +8.430 | -3.548 | +12.786 |
| 7775 | 2026-08-14 | -2.039 | -2.765 | 0.000 |
| 6088 | 2026-09-08 | +3.416 | -2.899 | +4.167 |
| 6264 | 2026-10-05 | +0.999 | **-7.696** | +2.714 |

6264 demonstrates a positive fifth-close return can conceal a deep intrahold adverse move. With a nominal JPY 200,000 position, -7.696% represents about JPY 15,392 mark-to-market loss before costs, exceeding a JPY 10,000 loss tolerance. Intraday order of high/low is unknown from daily bars; no executable stop-loss fill is asserted. Historical observations are only five and do not establish future downside bounds. SHADOW_NOT_APPROVED.

## Idealized JPY 10,000 stop threshold sensitivity (2026-11-02)
Using the five completed historical events, the first daily low touching an entry-relative loss threshold was counted. Position values JPY 100k / 200k / 300k / 500k imply thresholds -10% / -5% / -3.333% / -2%. Touch counts were 0/5, 1/5, 2/5, 4/5. Hypothetical five-session hold mean was +5.338%. Assuming perfect execution at the exact threshold on first touch, with 0.1% friction per side, idealized stop-exit means were +5.338%, +4.100%, +2.042%, +1.420% respectively. No opening gap below the threshold was observed on first-touch days, but daily OHLC cannot establish actual fill, order priority or intraday path. This is NOT a validated stop-loss strategy. Lots, price ticks, spreads and execution costs remain unmodeled. No production or notification approval.

## 100-share lot and minimum-budget audit (2026-11-02, read-only)
Historical next-session entry prices and minimum 100-share multiples satisfying JPY 100k minimum exposure, with maximum budget JPY 500k. Lowest five-session daily low determines adverse excursion. Hypothetical fifth-close P&L deducts 0.1% per side; no taxes, actual fill verification, lot/market eligibility confirmation, or stop execution simulation.

| Code | Entry JPY | Minimum shares | Position JPY | Worst observed excursion JPY | Fifth-close hypothetical net JPY |
|---|---:|---:|---:|---:|---:|
| 4401 | 4064 | 100 | 406400 | -400 | +64622 |
| 5805 | 2706 | 100 | 270600 | -9600 | +22835 |
| 7775 | 434 | 300 | 130200 | -3600 | -2658 |
| 6088 | 552 | 200 | 110400 | -3200 | +3775 |
| 6264 | 2248 | 100 | 224800 | -17300 | +2248 |

Among five historical events, 6264 cannot meet both the JPY 100k minimum budget and JPY 10k maximum observed adverse excursion at any standard 100-share lot. The 100-share budget-eligible ranges: 4401 100; 5805 100; 7775 300-1000 (maximum 800 within *observed* JPY 10k excursion); 6088 200-900 (maximum 600 within observed JPY 10k excursion); 6264 100-200 (none within observed JPY 10k excursion). These are hindsight diagnostics, not prospective safe position sizes. No production release or notifications.

## Static code and test audit (2026-11-03)
Read-only inspection of ma75WickVolumeSafety.mjs, ma75WickVolumeForward.mjs, ma75WickVolumeReadiness.mjs and corresponding safety/forward test files. Candidate classification reads bars through signalIndex and prior 20 volume bars; future bars are reserved for auditMa75FillAndBudget. Tests explicitly check future-bar mutation does not alter candidate classification, timestamp ordering, overnight gaps, zero volume baseline, late capture and hypothetical fill status. Readiness hard-codes approved:false, status SHADOW_NOT_APPROVED.

Unresolved gate: classifyMa75WickVolume accepts caller-supplied ma75Today and ma75Prior as positive numbers without independently recalculating them from the same timestamped history. A caller could accidentally pass stale or future-adjusted MA values, even though this classifier itself does not read future bars. Add a research-only regression suite that derives and cross-checks the two 75-session averages from historical closes and rejects mismatches, preserving the existing shadow-only approval gate. Provenance timing remains plausible but not authenticated, and fillVerified:false correctly prevents promotion. No test execution is claimed from this static inspection. No production or notification change.
