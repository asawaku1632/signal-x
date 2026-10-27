# Development prospective snapshot replay probe — 2026-10-21

Development project only: `jdtqwryiyxeuoraecorw`. Production unchanged.

Executed one transactional SQL probe on `public.market_relative_prospective_ledger`:
1. Inserted synthetic snapshot (AI POWER 93).
2. Retried identical `signal_id` with `ON CONFLICT DO NOTHING`. Verified exactly one row, AI POWER still 93.
3. Retried same ID with conflicting AI POWER 10, also `ON CONFLICT DO NOTHING`. Verified exactly one row, AI POWER still 93.
4. Intentionally raised `ROLLBACK_REPLAY_PROBE_SUCCESS` to roll back the entire probe. The SQL endpoint reports this intentional rollback as an error.
5. Independently queried table afterwards: **0 remaining rows**.

Important limitation: SQL `ON CONFLICT DO NOTHING` by itself does not distinguish a matching retry from a conflicting retry. The TypeScript research-only conflict classifier and persistence orchestration are covered by separate synthetic CI tests; they have **not** been wired to an authorized live database client or verified together end-to-end. No real signal capture or automatic ingestion is enabled.
