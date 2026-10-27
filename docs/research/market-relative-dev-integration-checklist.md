# Development database persistence integration checklist

Status: **not yet executed end-to-end**. Research-only. Production unchanged.

The synthetic orchestration tests and transactional SQL probes have both passed separately. They do not establish that the TypeScript `persistResearchSnapshot` function has used a real Supabase/Postgres connection.

## Required integration proof

1. Run from an isolated trusted server test runner with development-only credentials. Never expose privileged credentials in browser code or CI logs.
2. Supply a Postgres-compatible `SnapshotStorage.query(sql, params)` adapter with actual bound parameters; do not interpolate user values into SQL.
3. Use one synthetic ID unique to the test and an explicit rollback/cleanup strategy that accounts for append-only triggers. Prefer a single database transaction rolled back at the end.
4. Call `persistResearchSnapshot` three times in one transaction: first input returns `inserted`, exact retry returns `duplicate`, altered AI POWER returns `conflict`.
5. Verify original AI POWER remains unchanged, and no test rows remain after rollback.
6. Exercise concurrent duplicate inserts separately; check transaction isolation and unique-constraint behavior.
7. Verify deny-by-default grants/RLS and ensure server-side role access is minimum necessary.
8. Record redacted output, migration identity, database project identity, and CI run link. Do not claim a live integration pass without these results.

## Safety boundary

No scheduled collection, real-time provider feed, market trading, production DB mutation, or production deployment is authorized by this checklist. The research readiness gate must remain fail-closed until independent source provenance, market-data rights, and explicit production approval are satisfied.
