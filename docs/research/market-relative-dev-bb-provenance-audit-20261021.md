# BB historical provenance gate — development audit (2026-10-21)

Read-only aggregate queries on development Supabase `jdtqwryiyxeuoraecorw`.

Of 425 BB rows, five are dev-only non-ticker identifiers. The remaining 420 have four-digit codes, numeric AI POWER snapshots in [0,100], and positive entry prices. **All 420 were inserted after their signal_date**, with a common `created_at` of 2026-08-11 10:50:17.413059 UTC (2026-08-11 19:50:17 JST).

| signal_date | count |
|---|---:|
| 2026-08-05 | 1 |
| 2026-08-10 | 419 |

Interpretation:
- This may be a delayed import/backfill. A delayed insert does not prove scores were fabricated, but the database creation timestamp **does not independently demonstrate** that AI POWER and entry prices were frozen before the signal.
- Do not label these 420 records as independently verified real-time predictions or eligible out-of-sample performance observations.
- Original immutable source artifact, generation timestamps, job logs, and price snapshots must be verified separately.
- Market benchmark observations and forward outcome prices remain absent in the development market-relative research dataset.
- These 420 are **snapshot-shape candidates only**, not 420 eligible returns.

No database writes, production changes, or automated ingestion.
