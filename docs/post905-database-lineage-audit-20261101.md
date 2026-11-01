# 9:05 research: database lineage and safe evidence access (2026-11-01)

## Verified from repository source
- `app/lib/postgres.ts` creates the app PostgreSQL pool from `process.env.DATABASE_URL`; it does not select the development DB by project ref.
- `app/lib/learning/aiReversal.ts` uses that pool to write `ai_reversal_observations`, joining `daily_stock_results` and `pattern_learning_logs`.
- `app/api/admin/ai-reversal/route.ts` reads the same pool for owner-facing forward statistics.
- `.github/workflows/bb-shadow-dev.yml` explicitly assigns `secrets.SIGNALX_DEV_DATABASE_URL` to `DATABASE_URL` **for that workflow only**; its manual `SAVE` option is not part of this audit.
- `scripts/probe-bollinger-shadow-dev-connection.mjs` uses `TECHNICAL_BB_PHASE8_DEV_DATABASE_URL` for an isolated, manual development-only probe. Do not infer that this is the application's `DATABASE_URL`.

## Read-only development DB inspection (Supabase project jdtqwryiyxeuoraecorw)
- `research_scan_feature_captures`: 0 rows.
- `ai_judgment_fixed_cohort_observations`: 0 rows.
- `broad_ai_research_snapshots`: 0 rows.
- `swing_universe_observations`: 0 rows.
- `bb_prospective_research_intake`: 0 rows.
- `technical_bb_observation_snapshots`: 6 rows, dated 2026-08-21 through 2026-10-14.
- `daily_stock_results` and `ai_reversal_observations` were not present in the inspected development DB public schema.

## Interpretation
These findings establish only the contents of the inspected development database, not the absence or deletion of records in other environments. Historical research counts reported from a different connection cannot be assumed to be present here. The production connection's identity is unverified; do not probe it without separate authorization.

## Safe next steps
1. Inspect deployment configuration **metadata only** from the correctly scoped account/team: whether `DATABASE_URL` is defined for each environment and which deployment owns it. Never print or copy connection strings, credentials, passwords, or decrypted environment values.
2. Compare non-secret project references and database identities only when an authorized, read-only connection is available.
3. Establish provenance per observation: symbol, trade date, provider, source bar end, receipt time, capture time, independent replay, and outcome date.
4. Treat retrospective 9:05 classification as historical only. Do not enable notifications or production decisions without out-of-sample forward validation and execution-cost analysis.

## Restrictions
No production DB access, no schema changes, no data writes, no paid J-Quants API calls, no job triggering, no notification activation. This is documentation, not proof of trading edge.
