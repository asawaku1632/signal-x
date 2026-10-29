# DEV five-session BB observation timing audit — 2026-10-29

Read-only SQL aggregation from DEV Supabase `jdtqwryiyxeuoraecorw`; joined `technical_bb_observation_results`, `technical_bb_observation_events`, `technical_bb_observation_snapshots`, filtered `horizon=5`. Production untouched.

| Observation day | Event-result rows | Unique stock-days | Saved before bar end | Saved before future evaluation | Snapshot created UTC | First evaluation UTC |
|---|---:|---:|---:|---:|---|---|
| 2026-08-21 | 5 | 3 | 0 | 5 | 2026-08-22 13:45:53 | 2026-08-28 10:03:51 |
| 2026-08-28 | 1 | 1 | 0 | 1 | 2026-08-29 12:07:31 | 2026-09-04 11:11:32 |

All six snapshot records were stored **after** their nominal observation day and bar end, but **before** their respective future outcome evaluation timestamps. That establishes a chronology of stored observations preceding evaluation, **not** that the indicators were available or frozen at the claimed signal time, nor that price provenance and licensing were independently verified.

The 6 event-result rows reduce to 4 independent stock-day outcomes. No strategy performance, AI improvement, or automatic model weight promotion may be inferred. This cohort has only 2 observation dates and is insufficient for a credible out-of-sample comparison.

Follow-up: independently attest provider timestamps and original signal generation, obtain a materially longer prospective date series, validate horizons and transaction costs, then compare frozen baseline vs candidate on unseen dates.
