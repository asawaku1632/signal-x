# SIGNALX daily-stock outcome lineage — code audit (2026-10-26)

## Verified from code
1. `app/api/learning/save-daily/route.ts` calls `saveDailyStocks(targetDate, stocks)` after scan/coverage checks.
2. `app/lib/dailyLearning.ts` writes `daily_stock_results` with id `${date}-${code}`, date, code, name, score (`stock.score ?? stock.aiPower ?? 0`), and `price` (`stock.price`). It sets `result='UNKNOWN'` and `created_at=NOW()`. On conflict it does nothing.
3. The same module has `updateDailyStockResult(id,{nextPrice,changePercent,result})`, which updates `next_price`, `change_percent`, `result` to WIN/LOSE/HOLD, and `checked_at=NOW()`. This function **does not establish** which provider, quote timestamp, trading-day horizon or split-adjustment produced `nextPrice`.
4. `app/lib/learning/accuracyEvaluator.ts` reads these preexisting labels and reports WIN/(WIN+LOSE), not independently calculated 5/10/20-session future close returns.
5. `app/api/learning/judge/route.ts` is a **different SQLite `learning_logs` path**, not evidence of how `daily_stock_results` gets updated. It calls Yahoo Finance, uses a current quote or entry-price fallback, and labels win/lose; do not conflate the two tables.

## Critical conclusion
Current daily AI POWER accuracy numbers **cannot yet be certified as independently J-Quants validated** from this code. Do not train/boost/reduce production AI weights on those labels alone.

## Unresolved trace
- Find every call to `updateDailyStockResult` and its quote source, quote time, day-offset and price adjustments.
- Check `daily_stock_results` actual schema, existing record count and dates read-only when access permits.
- Determine whether historical J-Quants daily closes are licensed for internal validation and any user-facing derivatives.
- Build separate read-only 5/10/20-trading-session outcomes, preserving immutable original price and scores.

## Safety
Source audit only; no API calls to market providers, no DB changes, no changes to AI, notifications or production cron.
