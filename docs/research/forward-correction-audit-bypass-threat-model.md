# Forward correction: audit-bypass threat model (2026-10-28)

## Verified behavior
- CI #324 passed 189/189 tests for an *opt-in* correction statement that atomically inserts its audit entry and updates the outcome.
- The statement does not constrain all other database writers. A role with UPDATE permission can issue a direct UPDATE without a correction audit entry. The isolated PostgreSQL bypass test deliberately demonstrates this risk in rollback-only CI.

## Before production adoption
1. Establish a dedicated low-privilege application role. Revoke direct UPDATE on protected forward input columns and future-outcome columns from general application roles.
2. Implement correction as a carefully reviewed SECURITY DEFINER function with fixed search_path, strict actor identity from trusted authentication, explicit source evidence, idempotency and transaction-scoped row locking. Require a nonempty reason and inspect permission escalation.
3. Deny direct INSERT/UPDATE/DELETE to the audit log for general application roles, and review access to owner/superuser/service roles. Prevent unlogged changes via all permitted paths.
4. Use least-privilege ingestion for one-time initial observation and first-write forward outcome; isolate permissible column-level updates.
5. Add tests for unauthorized direct UPDATE, forged actor, repeat correction, missing reason, different outcome date, and failure rollback. Current tests do **not** establish these protections.
6. Capture immutable price provenance and verify contemporaneous price inputs. Historical rows are not automatically validated by a new control.

Research only. No production role, DB schema, code, ranking or alerts have been changed.
