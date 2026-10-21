# Phase 3 — Signal provenance check (2026-10-21)

Read actual source:
- app/lib/learning/swingExitAudit.ts: fresh snapshot requirement (<=2h, same JST business day), paper_trades open positions, EXIT-only capture; 1/3/5/10 outcome horizons. This does NOT provide an immutable historical BUY-condition event stream.
- app/lib/learning/bbObservation.ts: BB signal state/event persistence and duplicate-code rejection, but BB event != general BUY-condition trigger.
- app/api/cron/line/route.ts: contains score-derived text labels such as score>=85 '買い'; a display label alone is NOT proof that the separate configured buy-condition notification fired.

Conclusion: Cannot safely claim that buy-condition event timestamps/prices are already recorded. Need trace notification predicate, recipient eligibility, event persistence and quote provenance before wiring new capture. Keep research branch isolated. Do not backfill the 2026-10-21 3762 case as verified BUY event.

Next: identify actual configured buy-condition notifier and immutable log; add fixture-driven pure evaluator with 1/3/5/10/20 trading-day outcome tests before any production data write.
