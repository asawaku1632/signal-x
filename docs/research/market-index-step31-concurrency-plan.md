# STEP 31 — Concurrent save and retry test plan

Status: TEST PLAN COMPLETE; true concurrent test NOT EXECUTED.

Use two independent DB connections and an isolated dev-only finalization table with real `UNIQUE(index_key,session_date)`. Start two writes for same index/session with different source IDs. Commit winner, assert loser `ON CONFLICT DO NOTHING RETURNING` returns zero rows. Retry after commit; assert zero inserted rows and the original source ID unchanged. Run the same date with TOPIX to prove independent key. Inject failures before/after commit, test crash recovery and verify no history loss. Always use explicit cleanup or isolated rollback and inspect residues before reruns. Check authorization, same-origin request protections, timeout handling, and disable automation. Real save-route integration and parallel writes remain untested.
