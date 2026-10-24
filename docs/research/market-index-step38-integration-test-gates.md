# STEP 38 — Integration test readiness and fail-closed gates

Status: gate review complete; actual two-connection integration test NOT RUN.

Current manual save route is a preview-only, admin-only unavailable-status recorder. Its JST calendar-day lock/check is not a market-session finalization mechanism. STEP 33 added strict Origin equality. Actual finalization requires a separate private table, approved provider licensing, verified market-session date, source evidence and security review.

Test prerequisites: reviewed dev-only schema, private privileges/RLS, independent connections, same-key concurrent writes, retry after commit, correction handling, failure injection and cleanup verification. Never use existing unavailable records as licensed data. No production writes or scheduler.
