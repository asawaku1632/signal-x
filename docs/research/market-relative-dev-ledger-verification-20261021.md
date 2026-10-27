# Prospective ledger development verification — 2026-10-21

**Development only** Supabase project `jdtqwryiyxeuoraecorw`. Migration applied with name `market_relative_prospective_ledger_dev_only`.

Table `public.market_relative_prospective_ledger` has primary key `signal_id`, range/identity/timestamp CHECK constraints, RLS enabled, anon/authenticated/public privileges revoked, and two triggers rejecting UPDATE/DELETE and TRUNCATE. No application write access was granted; no collection job is active.

Verification:
- Database metadata: RLS true, two user-defined mutation triggers.
- Transactional synthetic probe: inserted one synthetic snapshot, confirmed duplicate unique violation, UPDATE rejection, DELETE rejection, and original AI POWER unchanged.
- Probe intentionally raised `ROLLBACK_PROBE_SUCCESS` after all assertions to roll back the transaction. This appears as a SQL error, **by design**.
- Independent follow-up count: **0 rows** remaining.
- Supabase security advisor flagged `rls_enabled_no_policy` for this table (INFO). This is intentional deny-by-default for the research-only table; no client access is intended. Other project-wide advisor findings are not resolved by this change.

Limitations: these are synthetic checks, not proof of provider freshness or real-time signal capture. Privileged administrators can modify database schema; append-only triggers are not cryptographic immutability. Production unchanged. Do not enable ingestion without explicit review and approval.
