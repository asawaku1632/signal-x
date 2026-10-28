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
