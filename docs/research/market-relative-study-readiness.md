# Market-relative study: readiness and evidence gates

## Current status (2026-10-21)
- Research-only pure calculations and synthetic CI fixtures are passing.
- The Yahoo chart read-only probe returned TOPIX HTTP 404 for four attempted symbols.
- No verified TOPIX intraday source, no production database migration, no enabled ingestion cron, and no live observational sample in the new research table.
- A passing synthetic unit test **does not** establish that SIGNALX predicts stock performance.

## Minimum evidence required before presenting win rates
1. Immutable signal-time AI POWER, stock code, source timestamp, horizon and original price. No post-event reconstruction.
2. Index benchmark with independently validated identity, date/time, provider rights and completeness.
3. Matched horizon and price convention (09:05-to-09:05 versus close-to-close); never compare mixed conventions.
4. Count **all** eligible signals, including losses, delistings, unfilled prices, data gaps and suspensions; report excluded count and reasons.
5. Deduplicate by immutable signal ID; avoid counting overlapping observations as independent successes.
6. Use a separate future time period for validation; do not tune thresholds on the same period used to claim success.
7. Report sample size, mean/median excess return, positive fraction, downside distribution and confidence intervals; stratify by market regime.
8. No purchase recommendation or notification wiring from this study until independently reviewed.

## Release gate
Do not merge draft PR #196 until (a) code review, (b) live provider verification, (c) dev-only integration write/read proof, (d) data usage rights, (e) migrations/RLS review and (f) production change approval.

## Important nuance
The existing `summarizePowerCohorts`, `summarizeLowPowerReversals`, and `summarizeRatingSurprises` are retrospective aggregation primitives. They do **not** themselves ensure matched horizon across input rows or independently validate original prices; upstream dataset construction must enforce those rules.
