# STEP 28 — Market-index daily finalization design (research only)

Status: DESIGN + ISOLATED TEMP-TABLE PROBE PASSED. NOT DEPLOYED AS A PERSISTENT SCHEMA OR SAVE PATH.

## Separate history from the finalized daily value

- Keep `public.market_index_research_runs` append-only for each observation attempt. The primary key on `run_id` prevents only exact-ID duplicates.
- Propose a **separate, private** daily-finalization table in the dev database, keyed by `(index_key, session_date)`. Do not add a uniqueness constraint to the observation-history table.
- Store a reference to the accepted `run_id`, provider identity, source timestamp, finalization timestamp and data-rights evidence. Do not promote `unavailable`, test fixtures, or rights-unverified observations to finalized data.
- Resolve `session_date` from the provider's actual Japanese market session calendar; do not infer it from `checked_at` alone. Validate holidays, delayed observations, timezones and late corrections.
- First successful finalization wins by default. A later provider correction requires a separate, explicitly audited correction path; never silently overwrite an accepted daily value.
- Concurrent finalizers must rely on a real DB unique constraint plus `INSERT ... ON CONFLICT DO NOTHING RETURNING ...` in one transaction, not only application locks.
- Keep this entirely out of production, scheduled collection, AI POWER, notification and trading paths pending provider licensing, integration tests and authorization.

## Evidence collected

- On 2026-10-24, the dev DB showed no duplicate groups for `(index_key, (checked_at AT TIME ZONE 'Asia/Tokyo')::date)` among existing rows.
- The only index on the existing history table was its `run_id` primary key.
- A transaction-local TEMP table with UNIQUE(index_key,session_date) accepted Nikkei and TOPIX for the same date and skipped a second Nikkei insert via ON CONFLICT DO NOTHING. Final count: 2; transaction rolled back.
- This does **not** establish real concurrent behavior, licensed market-data availability, or the actual manual-save path's idempotency.

## Acceptance gates before persistent dev-only rollout

1. Inspect real save-route behavior and define the finalization eligibility rules.
2. Validate business-date semantics against an authorized provider and Japanese market calendar.
3. Prepare reviewed dev-only schema migration with RLS/privileges for private data.
4. Test parallel writers and retry-after-commit against the actual dev-only save path; assert exactly one final row and intact attempt history.
5. Exercise provider correction, partial failure, crash/retry and rollback scenarios.
6. Obtain explicit authorization before enabling persistent dev writes or any automation.
