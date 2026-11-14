# Development-only dedicated login test: manual secure setup

**Status:** Direct-login test not run. Do not use production project `paygtakajhvatwejygda`; use only `signal-x-dev` (`jdtqwryiyxeuoraecorw`).

The current `scan_provenance_writer` role is `NOLOGIN`, and the earlier `SET ROLE` test does not establish an independent authenticated connection.

## Credential-safe preparation

Using a secure local `psql` session connected as an administrator **to signal-x-dev only**, confirm the project with `SELECT current_database(), current_user;` and your connection settings without exposing passwords. In that trusted session:

```sql
-- Development only. Never run in production.
ALTER ROLE scan_provenance_writer LOGIN NOBYPASSRLS;
```

Then use psql's interactive `\\password scan_provenance_writer` command to set a long random password **without writing it to SQL scripts, chat, shell history, GitHub or CI logs**. The existing role has only schema USAGE, table INSERT and sequence USAGE; it must not be made an owner, superuser or BYPASSRLS.

Set `SCAN_PROVENANCE_DATABASE_URL` **only in the local process environment**, pointing to the development project and the restricted login. Do not use `NEXT_PUBLIC_`, `DATABASE_URL`, Vercel production settings or a privileged postgres connection. Verify your connection host and role before running the test.

The manual probe refuses non-development project references and non-writer usernames. Run from a trusted local checkout of the PR branch:

```powershell
$env:SCAN_PROVENANCE_PERMISSION_PROBE = "true"
node .\\scripts\\research\\scan-provenance-dev-permission-probe.mjs
Remove-Item Env:SCAN_PROVENANCE_PERMISSION_PROBE -ErrorAction SilentlyContinue
Remove-Item Env:SCAN_PROVENANCE_DATABASE_URL -ErrorAction SilentlyContinue
```

The probe starts a transaction, attempts an INSERT and duplicate INSERT, verifies that SELECT/UPDATE/DELETE/TRUNCATE fail with SQLSTATE 42501, then **ROLLBACKs**. Each expected permission error is isolated with a SAVEPOINT. No synthetic test row should remain. A failed probe also attempts ROLLBACK. Do not print the connection URL or its password.

## Evidence required before changing release status

- Authenticated `current_user=session_user=scan_provenance_writer`.
- First insert rowCount 1; duplicate rowCount 0.
- SELECT, UPDATE, DELETE, TRUNCATE denied (42501).
- No synthetic rows after rollback (verified by separate admin SELECT).
- Research CI, TypeScript build, and latency isolation verified.
- Keep `SCAN_PROVENANCE_SHADOW_ENABLED` unset. Do not merge/deploy PR #384.

The role change is not performed by this document or PR. A user with approved administrative access must carry it out locally and keep credentials secret.
