# SIGNALX DEV evidence audit — 2026-10-29

Read-only investigation of **DEV** Supabase project `jdtqwryiyxeuoraecorw`. No production queries or writes. These are **DEV observations**, not a complete inventory of the production learning history.

## Findings

- `bb_signal_events`: 425 total, 420 syntactically valid-code positive-price records on two dates (2026-08-05: 1; 2026-08-10: 419). Five fixture events excluded.
- `technical_signal_events`: 313 positive-price valid-code records, all on 2026-08-14.
- `bb_signal_event_results`: five results, all attached to DEV fixture code `__DEV_BB_...`. Only one is horizon 5; none support real-code validation.
- `technical_signal_event_results`: zero.
- `technical_bb_observation_snapshots`: six snapshots, including Aug 21, Aug 28 and Oct 14.
- `technical_bb_observation_events`: ten events.
- `technical_bb_observation_results`: 22 outcomes: horizon 1 = 10 on three observation dates, horizon 3 = 6 on two dates, horizon 5 = 6 on **two** dates. All have `horizon_unit='TRADING_DAY'` and `result_quality='COMPLETE'`. These rows are **descriptive candidate evidence**, not independently audited forward forecasts.
- All 6 BB observation snapshots have `provider='YAHOO_CHART'`; snapshots were saved after their observation bar closed. This does not prove signal generation occurred before the outcome window.
- The following other DEV research tables have zero rows at audit time: `bb_daily100_signals`, `bb_daily100_outcomes`, `bb_breakout_shadow_outcomes`, `bb_breakout_expansion_outcomes`, `dual_surge_shadow_outcomes`, `ema_forward_shadow_trades`, `broad_ai_research_snapshots`, `bb_prospective_research_intake`, `ai_judgment_fixed_cohort_observations`, `market_relative_prospective_ledger`, `market_index_shadow_observations`, `swing_universe_observations`, `weekly_sector_forecasts`, `weekly_sector_outcome_audits`, `msb_volume_research_observations`.

## Important distinction

Prior statement that DEV has no real-code forward outcomes was too broad: the `technical_bb_observation_results` table **does contain** six complete 5-trading-day results for real-code observations on two dates. However, it is a **different schema and research cohort** from `bb_signal_event_results`, and does not validate the 733 BB/technical signal-event records. Six observations across two dates are not enough for generalization, and `COMPLETE` is not proof of independent source provenance, legal data rights, or a pre-registered prospective prediction.

## Next steps before any AI integration

1. Audit original signal generation and snapshot creation timestamps, market bar end and evaluated date for each candidate, in JST.
2. Verify each future closing price against licensed, independently sourced exchange sessions; check splits/corporate actions.
3. Confirm no hindsight reconstruction, repeated candidate leakage or overlapping evaluation windows.
4. Obtain broader non-overlapping out-of-sample periods and a same-date baseline, including transaction costs.
5. Require external/manual review and explicit production approval. Never promote based on row count or self-reported verification flags.

All work is **shadow-only**; no production DB, notification, ranking, model weights, or PR #216 changes.
