# STEP 32 — Isolated daily-finalization simulation and gates

Status: ISOLATED TEMP-TABLE PROBE PASSED; actual save-path integration NOT TESTED.

On 2026-10-24 in dev Supabase `jdtqwryiyxeuoraecorw`, a transaction-local TEMP table with `UNIQUE(index_key,session_date)` and `CHECK(provider_rights_verified)` / `CHECK(observation_status='available')` was used. Synthetic authorized-like fixtures (NOT actual licensed market data) for Nikkei and TOPIX on 2026-10-23 were inserted. A second Nikkei insert with a different source run ID used `ON CONFLICT DO NOTHING`. The query returned `final_rows=2, nikkei_rows=1, topix_rows=1`. The transaction was rolled back. No existing records changed.

Caveats: This only verifies SQL uniqueness behavior in one connection; it does not prove concurrent writers, actual provider rights, exchange-session correctness, crash safety or real manual-save idempotency. Persistent private table, migration, automatic collection, production and notifications are not enabled. Next gates: approved provider and calendar, dev-only schema security review, actual concurrent integration test, correction audit and verified cleanup.
