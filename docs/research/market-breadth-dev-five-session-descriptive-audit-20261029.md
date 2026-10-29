# DEV observed five-session outcomes: descriptive audit (2026-10-29)

Source: read-only SELECT against DEV Supabase project `jdtqwryiyxeuoraecorw`, joining `technical_bb_observation_snapshots` -> `technical_bb_observation_events` -> `technical_bb_observation_results`, restricted to `horizon=5` and `result_quality='COMPLETE'`. No DB changes.

| Observation date | Code | Event rows | Five-session return % | Max rise % | Max drawdown % |
|---|---|---:|---:|---:|---:|
| 2026-08-21 | 8591 | 2 | +1.6844 | +5.0531 | +0.0164 |
| 2026-08-21 | 9432 | 1 | +1.5051 | +2.3480 | -0.7225 |
| 2026-08-21 | 9983 | 2 | -3.0608 | +0.1360 | -4.5028 |
| 2026-08-28 | 9983 | 1 | -3.0312 | +1.8804 | -4.9116 |

Six event results represent only **four unique stock-date observations**, across **two observation dates**, **three distinct stocks**. Stock-date equally weighted mean return: **-0.725625%** (rounded from four displayed observations); median approximately **-0.76305%**; positive outcomes **2/4**. The repeated stock 9983 appears on both dates and should not be treated as independent stock replication. Date-level mean returns are approximately +0.0429% on Aug 21 and -3.0312% on Aug 28. These descriptive figures are not a strategy return or prediction win rate.

Temporal facts: Aug 21 snapshots saved Aug 22 13:45 UTC, evaluated Aug 28 10:03 UTC; Aug 28 snapshot saved Aug 29 12:07 UTC, evaluated Sept 4 11:11 UTC. The snapshots were saved **after** their nominal observation dates; this does not prove contemporaneous signal generation or independent price attestation. Stored provider and timestamps alone are insufficient evidence of data licensing or predictive causality.

**Decision:** research-only, no live notifications, no AI POWER weighting changes, no production promotion. Need original as-of signal attestations, verified provider rights, independently verified forward prices, more distinct dates and symbols, a frozen baseline, transaction costs, and chronological out-of-sample comparison. This DEV table is not the separately stored legacy PostgreSQL `daily_stock_results` dataset.
