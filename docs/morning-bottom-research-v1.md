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
