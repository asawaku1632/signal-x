# WATCH low-vs-high AI POWER: frozen prospective holdout v1

Freeze date 2026-10-24. Implementation: `app/lib/learning/watchPowerHoldout.ts` on isolated research branch. Prior discovery/training signals through 2026-10-16 are **excluded** from holdout. WATCH label and AI POWER must be captured on the signal date; outcomes are five trading sessions later. Groups: low <68, high >=71; middle excluded from group contrast but not silently reclassified.

The pure evaluator accepts frozen records, excludes training dates, computes per-date group means, positive-difference date count, and marks review readiness only after >=10 comparable holdout dates. It reports missing outcomes and conflicting duplicate records. It does not fetch from Supabase, schedule a cron, change UI, notify, or trade. Unit tests and integration wiring have **not** been executed/added in this commit, so do not call it deployed or operational.

This is a **research hypothesis**, not a signal: next tradable session price, commissions/slippage, sector and size controls, and statistical robustness remain unverified. Require prospective replication before production changes. No database mutations.
