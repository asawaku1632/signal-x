# Scan provenance shadow: DB writer security gate (2026-11-14)

## Verified (read-only production inspection)
- `app/lib/postgres.ts` uses `pg.Pool` and server-side `DATABASE_URL`. The deployed connection username has **not** been verified.
- Existing `public.ai_power_scan_audit` has RLS enabled and no SELECT/INSERT privileges for `anon` or `authenticated`.
- Both `postgres` and `service_role` have UPDATE, DELETE, TRUNCATE and INSERT privileges on the existing audit table.
- Proposed `public.ai_power_scan_provenance_shadow` has **not** been created in production.
- No production schema or runtime environment changes have been made.

## Mandatory before enablement
1. Inspect the **username only** of the deployed server `DATABASE_URL` via the hosting environment's secure configuration, without printing the password or full connection string. Do not assume `service_role` or `postgres`.
2. Decide whether to provision a dedicated least-privilege login for the research writer. Prefer INSERT-only on a private, non-Data-API schema, with a separately privileged read-only research role; no UPDATE, DELETE or TRUNCATE. Confirm the runtime can actually use that role.
3. A table owner or superuser can still mutate rows. Hashes of the stored row do not make an archive tamper-proof; independent immutable off-database storage or signed external checkpoints would be needed for stronger integrity claims.
4. If the existing shared `DATABASE_URL` must remain in use, **do not revoke privileges from that shared role** merely to protect this table; that could break other features. Keep the shadow feature flag off until a compatible safe writer design is tested.
5. Test actual DB permissions as the chosen writer and as `anon`/`authenticated`, and verify insert, duplicate conflict, attempted UPDATE/DELETE, and scan-failure isolation in a nonproduction environment.
6. Record the exact deployed code SHA, capture cutoff, market-data availability times and learning-statistics as-of times. The current capture records only summary fields and intentionally marks full replay and predictive success unverified.

## Read-only inspection SQL
```sql
SELECT current_user, session_user;
SELECT c.relname, c.relrowsecurity,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('ai_power_scan_audit','ai_power_scan_provenance_shadow');
```

## Release decision
**NO-GO** for enabling `SCAN_PROVENANCE_SHADOW_ENABLED` until all mandatory gates pass. PR remains research-only and unmerged.

## Vercel configuration inspection (2026-11-14; metadata only)
- GitHub-linked Vercel project: `signal-x`, project ID `prj_aVyZPjouc0Mp8KU6f7bLHRDC2tJE`.
- `DATABASE_URL` is configured as a sensitive variable for production and preview. Its value was **not decrypted or inspected**.
- No `SCAN_PROVENANCE_SHADOW_ENABLED` entry was present in the project environment-variable listing.
- This metadata does **not** establish the deployed PostgreSQL username, the effective grants of that user, or the absence of a flag configured elsewhere at runtime.
- Next verification requires a reviewed, safe method of obtaining only the effective database role from the running app or secure hosting configuration, without exposing the connection string. Do not run privileged production DDL or enable the capture flag before that review.

## PostgreSQL role inspection (read-only, 2026-11-14)
- `postgres`: LOGIN=true, BYPASSRLS=true, SUPERUSER=false.
- `authenticator`: LOGIN=true, BYPASSRLS=false.
- `service_role`: LOGIN=false, BYPASSRLS=true.
- `anon` and `authenticated`: LOGIN=false, BYPASSRLS=false.
- Therefore `service_role` cannot itself be the direct login username for the application's `pg.Pool` connection. It can still be an assumed role or used by API services; this does **not** identify the deployed `DATABASE_URL` username.
- If the app logs in as `postgres`, ordinary RLS is not an effective protection against that connection because `postgres` bypasses RLS. Do not claim the shadow archive is immutable or isolated until the runtime login and its effective role privileges are independently verified.
- Avoid a production endpoint that returns credentials, role information or connection-string fragments to users. Use a reviewed internal-only diagnostic or secure hosting configuration inspection when approved.
