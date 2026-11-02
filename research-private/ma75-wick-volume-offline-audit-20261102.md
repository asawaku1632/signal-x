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
