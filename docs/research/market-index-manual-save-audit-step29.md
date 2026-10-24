# STEP 29 — Actual manual-save route audit (2026-10-24)

**Scope:** research branch `research/market-index-shadow-20261021`, actual handler `app/api/admin/market-index-research/route.ts` POST, dev DB `jdtqwryiyxeuoraecorw`. This is a **source review and read-only DB audit**, not an execution of the POST handler or a new persistent table.

## Findings

1. `save-unavailable-status` is a preview-only admin action for a **missing-provider/rights-unverified status**, not a licensed daily index value. It accepts `nikkei` or `topix`; it writes `status='unavailable'`, `reason='PROVIDER_APPROVAL_REQUIRED'`, and `provider_rights_verified=false`.
2. The handler obtains a transaction-scoped advisory lock keyed by index, then checks for a row with matching index, reason and **current JST calendar day**, and skips a second insert when found. This is application-level serialized deduplication for this one action, not a unique database constraint.
3. The handler creates a random `run_id` for each request; the `run_id` primary key cannot prevent a duplicate business-day record when the application-level lock/check is bypassed or a different writer is introduced.
4. **JST calendar day is not a market session date**: weekends, holidays, delayed market data and provider corrections require an explicit session calendar. No genuine daily-final value is written by this route.
5. The handler lacks the explicit same-origin check used by the separate commit/retry test route. Before enabling any additional write workflow, review CSRF protections and authorization.
6. Existing dev DB only has the `run_id` primary key index; the query checking duplicate `(index_key, JST day)` groups returned none. No schema changes were made.
7. A prior isolated temporary-table experiment proved `UNIQUE(index_key,session_date)` plus `ON CONFLICT DO NOTHING` can keep one final row per index/session, without restricting attempt history. It did **not** test concurrent writes or this actual handler.

## Proposed safe implementation

- Preserve `market_index_research_runs` as the attempt history; do not add a date uniqueness rule to this table.
- Implement a separate **private** daily-final table keyed by `(index_key, session_date)` with DB-enforced uniqueness; validate the session date from an authorized provider/exchange calendar.
- Gate finalization on verified provider rights, actual source observation and quality; never finalize `unavailable` placeholders.
- Implement an explicit audited correction flow instead of silently replacing final rows.
- Before persistent dev writes: inspect privileges/RLS, create reviewed migration, add strict preview/admin/origin checks, test concurrent writers and retry-after-commit against the actual save path.
- Keep scheduler, production database, AI POWER, notification and trading disconnected until separately approved.

**Outcome:** source review and read-only inspection complete. Actual save-path concurrency and daily finalization remain **NOT TESTED**.
