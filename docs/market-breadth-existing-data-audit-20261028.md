# Existing development-data reuse audit — 2026-10-28

Research-only inspection of **development** Supabase project. All queries were SELECT only. This document is a point-in-time inventory, not evidence of signal accuracy or data-provider rights.

## Exact counts
| Table | Rows | Coverage |
|---|---:|---|
| bb_signal_events | 425 | 7 signal dates; 422 codes |
| technical_signal_events | 313 | 1 signal date; 312 codes |
| bb_signal_event_results | 5 | 5 evaluated dates; 2 event IDs |
| technical_signal_event_results | 0 | none |
| dual_surge_shadow_candidates | 0 | none |
| bb_daily100_signals | 0 | none |
| market_relative_prospective_ledger | 0 | none |
| market_index_shadow_observations | 0 | none |
| us_economic_market_observations | 0 | none |

## Timestamp mismatch
- All 425 BB events were written on 2026-08-11 UTC within roughly one minute; their signal dates span 2026-04-24 through 2026-08-10. **Zero** have JST(created_at) matching signal_date. created_at is not independent signal generation proof.
- All 313 technical events have signal_trade_date 2026-08-14, but detected_at ranges 2026-08-15 through 2026-08-16 UTC. **Zero** have JST(detected_at) matching signal_trade_date. All 313 have positive entry prices, but this does not establish contemporaneous price provenance.
- Do not reclassify these 738 rows as forward-real-time predictions, do not backdate timestamps, and do not use them to claim AI POWER improvements.

## Actual blockers
1. Find immutable independently timestamped signal records, not retrospectively created records.
2. Verify market breadth observations, original observation timestamps, and permitted provider rights.
3. Verify each five-session outcome using licensed data and an exchange trading calendar.
4. Only then feed independently attested rows into the offline research bundle and report exclusions.
5. Keep historical events as **retrospective descriptive** material unless independent provenance is recovered. Do not write to production or enable notifications.

## Next practical priority
Instrument prospective independent signal capture only after explicit authorization and provider-rights review. Do not deploy or enable automatic collection from this audit.

## Follow-up fixture and outcome investigation

SELECT-only development database inspection identified **five** nonstandard BB code records: four `__DEV_BB_TRANSITION_47__` and one `__DEV_BB_MISSING_47__`. No analogous marker was found in 313 technical events. BB has 420 records with a plausible 4-digit/optional-alpha code; technical has 313. All 738 records have positive entry prices but were recorded after their nominal signal dates.

All five BB outcome rows link to the two identified DEV fixture event IDs. Outcome horizons: one-day (2), five-day (1), ten-day (1), twenty-day (1). The five-day row reports +5% for `__DEV_BB_TRANSITION_47__`, and **must never be represented as live model performance**. None of these rows is independently verified prospective evidence. This is an explicit exclusion, not an inference of predictive success.

The review code now quarantines recognized fixture events and reports unverified outcome links separately. Do not extrapolate the five fixture rows to the other 733 rows, which still lack independent immutable generation-time proof.

## Independent-timestamp recovery search (development DB only)

A schema search identified seven additional tables with `signal_time`, `source_hash`, or similar historical-provenance fields. SELECT-only exact row counts were **zero** for each: `bb_breakout_expansion_outcomes`, `bb_breakout_shadow_outcomes`, `bb_breakout_volume_factors`, `bb_daily100_outcomes`, `ema_forward_shadow_trades`, `msb_volume_research_observations`, `swing_exit_audits`.

Therefore none of these seven development tables currently supplies independent generation-time evidence for the 733 plausibly formatted historical signals. This is **not** a global claim that no GitHub Actions artifacts, external records, or other databases contain such evidence.

Recovery priority: locate immutable original signal logs with independent capture timestamps and licensed price provenance; compare against nominal signal date and actual trading session; preserve a separate retrospective cohort for unverified legacy rows. Never reconstruct an original generation timestamp from `created_at` or `detected_at` assigned during a later backfill.

## Source-code origin tracing

On `main`, `app/lib/learning/bbObservation.ts` function `saveBbSignalEvents(signalDate,stocks,...)` computes `tradeDate = stock.bollinger?.tradeDate ?? signalDate`, inserts `signal_date` and other feature fields, **but does not insert an independent signal-generation timestamp**. Migration `scripts/migrations/20260811_create_bb_signal_observation.sql` defines `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Consequently `created_at` proves database insertion time, not the original time the price/signal was available. No original upstream timestamp is preserved by this insert.

The evaluator `evaluatePendingBbEvents` reads `signal_date` and entry price and fetches daily candles from a Yahoo chart endpoint. The outcomes table records future prices, returns and evaluation time but has no source license/provider evidence columns. The admin endpoint `app/api/admin/bb-observation/route.ts` aggregates these results without checking provenance. In the inspected development DB, all five recorded outcomes refer to DEV fixture codes; do not interpret the admin aggregates as independently verified performance.

Recommended future design (NOT deployed): separate immutable `signal_generated_at`, `source_observed_at`, `bar_end_at`, `recorded_at`, provider/rights verification and immutable source reference, and require chronological as-of constraints before a record enters forward evaluation. Historical rows lacking original evidence remain retrospective/unverified, not repaired by backdating.

## BB capture entrypoint traced

`app/api/cron/bb-observation/route.ts` reads `getLatestScanSnapshot()`, validates its `updatedAt`, item count, expected universe and same-day `daily_stock_results` count with `validateBbSnapshot`, then calls `saveBbSignalEvents(targetDate,stocks)`. The cron records a `runId`, target date, snapshot update timestamp and processing counts through `stageLog`. However, the signal insert persists neither the cron run ID nor the snapshot's `updatedAt` nor a per-symbol immutable generation timestamp. Therefore those runtime details cannot be reconstructed from `bb_signal_events` alone.

Potential safe future implementation (not yet connected): a separate SHADOW capture envelope containing `runId`, snapshot ID/hash, `snapshotUpdatedAt`, immutable `signalGeneratedAt` from original generator (not insertion time), `barEndAt`, `provider`, license verification and source reference, then join with verified five-session outcomes. A cron receipt timestamp is only an ingestion observation, never proof that a historical price was known at the claimed earlier signal time. Do not backfill these fields from `created_at`.
