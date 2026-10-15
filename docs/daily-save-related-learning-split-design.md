# Daily-save / related-learning split: data contract (design only)

Status: proposal, **not enabled**. No migration, cron, or production write is included.

## Why the current snapshot is insufficient
`daily_stock_results` currently persists date, code, name, score, price and result. `saveRelatedLearning` additionally uses `patternKey`, `patternLearning` (RSI band, MACD, VWAP, EMA20, trend), `changePercent`, and AI score. `savePatternForwardObservations` also consumes `patternLearning.patternObservations`. Re-scanning later is not equivalent to replaying the original 15:35 analysis.

## Proposed immutable input
Create a separately versioned, date-scoped payload containing **the exact validated scan stock inputs** consumed by both downstream functions. Use a versioned JSON schema, a SHA-256 content digest, source run ID, capture time and trade date. Do not use a fresh scan as a substitute. Ensure one canonical payload per date, with conflict detection (same date + different digest must fail rather than overwrite). Use a database transaction or durable staging/publish protocol so a partial payload is never marked ready.

Fields per stock:
- code, name, score, aiPower, price, changePercent, result
- patternKey
- patternLearning.rsiBand, trendKey, ema20Key, vwapKey, macdKey
- patternLearning.patternObservations (retain complete original nested data)
- any additional inputs verified by auditing every downstream function

## Safety and rollout
1. Inventory all downstream consumers and document exact replay inputs.
2. Add schema/migration in an isolated branch and dry-run only in disposable DB.
3. Add validation: date, unique codes, positive prices, stock count coverage, schema version, digest and exact payload completeness.
4. Write snapshot + immutable input durably, verify read-back and checksum, **then** mark it ready.
5. Implement a separate authenticated, idempotent worker with per-date locking and durable per-step checkpoints. Never execute it on partial input.
6. Schedule worker only after readiness, with its own timeout budget; isolate notifications from replay or dedupe them.
7. Keep current production behavior until shadow-mode replay matches current related-learning results. Switch via explicit feature flag after verification and rollback plan.
8. Retain original 15:35 stock snapshot and its source prices; never recalculate historical entry prices from a later scan.

## Open risks
- 180-second timeout currently covers scanning and serial post-save work.
- Related learning uses a transaction that deletes/rebuilds some date-scoped logs; concurrent or incomplete replay must be prevented.
- Some downstream functions swallow errors, so successful HTTP response alone is not proof of complete learning.
- Existing date-recovery path does not reconstruct missing original pattern fields.
- Before enabling, audit retention, payload size, sensitive fields, DB indexes and exact-once notification semantics.
