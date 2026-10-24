# Manual dev-only database integration runbook

The opt-in script `scripts/check-market-relative-dev-db-integration.mjs` is **not** run by CI and has not yet been executed against a real PostgreSQL connection.

## Preconditions

- Authorized development project: `signal-x-dev` (`jdtqwryiyxeuoraecorw`), region `ap-northeast-1`.
- Verified direct database host: `db.jdtqwryiyxeuoraecorw.supabase.co`. The script rejects other hosts.
- Use a trusted, isolated server-side environment with a **development-only** database connection. Do not commit or paste the database password into chat, code, PR comments, or logs.
- Database permissions must be reviewed for the minimum required INSERT/SELECT. The current test uses a privileged connection if provided; do not use client-side keys.
- Confirm the research ledger exists, RLS is enabled, and the database is not production.

## Execution (authorized operator only)

Set `SIGNALX_RESEARCH_DEV_PROJECT_ID=jdtqwryiyxeuoraecorw`, `SIGNALX_RESEARCH_DEV_DB_TEST=I_UNDERSTAND_DEV_ONLY`, and `SIGNALX_RESEARCH_DEV_DATABASE_URL` to the development-only Postgres connection string in the secure execution environment. Run `node scripts/check-market-relative-dev-db-integration.mjs` from the repository root with dependencies installed.

The test attempts a new insert, identical replay, conflicting replay, and original-value assertion within one transaction. A `finally` block issues ROLLBACK and closes the client. Verify zero leftover synthetic rows after execution.

## Interpretation

A passing run verifies the actual TypeScript persistence orchestration against development PostgreSQL; it does not prove provider provenance, TOPIX intraday availability, live collection readiness, or trading efficacy.

A failing run must not trigger fallback to production, broad grants, disabled RLS, or deployment. Diagnose with redacted errors only.
