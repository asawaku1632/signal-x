# Daily WIN/LOSE/HOLD provenance — source confirmed (2026-10-27)

## Code-confirmed algorithm
- `app/api/learning/save-daily/route.ts` calls `saveDailyStocks`; `app/lib/dailyLearning.ts` inserts `daily_stock_results` with score, price, and `result='UNKNOWN'`.
- `app/lib/learning/checkDailyRunner.ts` selects the **earliest later saved date** with valid price coverage, with `isSafeDailyCheckPair` rejecting skipped trading sessions and insufficient snapshot coverage.
- The runner joins the same code's later `daily_stock_results.price`, computes `round(((nextPrice-entryPrice)/entryPrice)*100, 2)`, and assigns WIN if >= +2%, LOSE if <= -2%, otherwise HOLD.
- It updates `daily_stock_results.next_price,change_percent,result,checked_at` and stores `daily_result_price_provenance` (source row id/date/price/snapshot timestamp) in the same transaction; mismatch rolls back.
- `app/lib/learning/winRateReliabilityAudit.ts` audits missing or inconsistent provenance and labels recent untraced results.

## Interpretation and limitations
- These are **next-session snapshot-to-snapshot threshold labels**, not verified J-Quants +5/+10/+20-session close outcomes.
- The saved snapshot `price` may not be an official close; its original feed, precise timestamp, adjustment and license are not established by this code. The provenance table traces the internal snapshot, **not its upstream market-data provider**.
- Older rows may lack provenance: migration/test explicitly do not backfill historical rows.
- `accuracyEvaluator.ts` calculates WIN/(WIN+LOSE), excludes HOLD from that denominator; this is not the proportion of all predictions with positive return.
- Code review does not establish real DB row counts, actual production execution, or historical return quality.

## Safe next work
1. Inspect `dailySavePriceSourceAudit`, scan output and snapshot timestamp/data-source handling to identify upstream origin.
2. Independently compare preserved original snapshots with licensed J-Quants daily OHLC on +5/+10/+20 trading sessions in a separate research-only process.
3. Require chronological holdout, corporate-action and missing-data controls before proposing AI weight changes.
4. Keep production score/notifications/cron unchanged and do not overwrite historical result labels.

Status: source-code audit only; no DB writes or J-Quants requests.
