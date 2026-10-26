# Morning 09:05 — development database access audit (2026-10-26)

**Read-only audit. No migration, grants, policy, write, provider request, or production change executed.**

## Observed

- Two distinct Supabase projects exist: `signal-x` (production) and `signal-x-dev` (development), both active. All SQL below ran on development only.
- Development has `public.morning_market_forward_runs`, `public.market_index_research_runs`, and other research tables. No table matching `%morning%` other than `morning_market_forward_runs` was found in the development public schema.
- RLS is enabled for the checked `morning_market_forward_runs` and `market_index_research_runs` tables.
- `pg_policies` returned **zero** policies for those two tables. This normally means client roles are denied under RLS unless bypass privileges apply; it is **not proof** of secure administrator access. Server-side service-role clients may bypass RLS.
- Development Supabase security advisor reported 47 INFO findings for RLS-enabled tables without policies. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

## Gate for an eventual isolated diagnostic table

1. Confirm provider terms permit derived metadata retention; do not assume Yahoo unofficial feed permits commercial automated collection.
2. Use development-only, research-specific schema/table with minimum fields from `MORNING_0905_METADATA_RECORD_DESIGN_20261026.md`.
3. No grants to `anon` or `authenticated` until an explicit administrator authorization design is reviewed. Prefer server-only guarded access with least privilege; avoid relying on service-role bypass as the only access control.
4. If a table is exposed through Data API, enable RLS and test denied unauthenticated and non-admin reads/writes and permitted admin-only reads. Test privilege and RLS together.
5. Define retention and redaction. No raw payload, symbol, OHLCV, tokens, or user IDs.
6. Add fail-closed offline tests before any live instrumentation; no extra requests, cron, notification, scoring, or main merge.

## Decision

**Not ready for DB writes.** Confirm licensing, exact authorization model, and negative access tests before creating or connecting a table. Existing research table RLS alone is insufficient proof of admin-only visibility.
