# Forward correction authorization — status after CI #344 (2026-10-28)

## Evidence
- CI #344: 192 tests passed, zero failures, zero skipped.
- Isolated PostgreSQL test confirms a restricted role cannot directly update forward result fields, while an explicitly granted SECURITY DEFINER correction function can write a correction and audit row.
- Repeating the same correction returns false without a duplicate audit row.
- Missing/short correction reason is rejected; the test verifies rollback using a savepoint.
- The original entry price remains unchanged through the corrected outcome test.

## Critical limitations before deployment
- The exercise uses synthetic rows and transaction-rolled-back CI roles/schema. It is not a production migration or live authorization review.
- Test function does not authenticate the human actor; executor role alone is not strong identity proof.
- Function ownership, schema privileges, trusted identity, secure search_path, PUBLIC privileges, and privileged direct writes require a full review.
- Audit tampering and simultaneous conflicting correction transactions have not been exhaustively tested.
- The existing live observation saving function can still overwrite entry_price.
- Historical forecasts remain unverified for point-in-time provenance; passing this suite must not trigger AI POWER updates or notifications.

## Practical next gate
Prioritize analysis of real source snapshots, input immutability and independent forward outcomes before further authorizing live AI feedback. An implementation PR for production roles, with explicit approval, is separate from this documentation.
