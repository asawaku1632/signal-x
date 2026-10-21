# Phase 8 — Unit tests and price provenance (2026-10-21)

## Executed test
Ran Node's test runner on a local copy of the pure calculation module and its four repository test scenarios. Initial run: 2 PASS / 2 FAIL due to strict float equality and a wrong horizon index in test expectations. Fixed tests in branch and reran: 4 PASS / 0 FAIL. This is NOT a full repository CI or production integration test.

## Source provenance
- app/lib/dailyLearning.ts saveDailyStocks persists stock.price from scan input into daily_stock_results. The function does not independently establish an official adjusted close or split adjustment.
- docs/price-reference-trend-phase2-20261010.md documents a targeted sample of 10 reference comparisons with 8 differences and explicitly warns against generalizing to all stocks. It is not evidence of a universal error rate.
- app/lib/learning/swingExitAudit.ts uses daily_stock_results for horizon observations, but this reuse alone does not validate corporate actions or quote provenance.

## Release gates
1. Add and verify quote-source timestamp, adjusted-close provenance, corporate-action policy and session-day readiness.
2. Add authenticated integration tests for owner-only endpoints, 403 for non-owner, and database query bounds.
3. Validate missing/late/future data handling and all 20 trading-day boundaries.
4. Only then allow verified return/recovery statistics. Keep research branch and production isolated until review.

No database mutations, cron deployment, or live data sampling occurred.
