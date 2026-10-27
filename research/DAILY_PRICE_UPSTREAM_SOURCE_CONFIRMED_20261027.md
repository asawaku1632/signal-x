# Daily saved-price upstream lineage — code audit (2026-10-27)

## Confirmed source path
1. `app/api/learning/save-daily/route.ts` fetches `/api/scan?limit=1000`, receives `stocks`, computes passive `buildDailySavePriceSourceAudit`, then calls `saveDailyStocks(targetDate,stocks)`.
2. `app/api/scan/route.ts` serves a cached display snapshot, refreshing it through `app/lib/scanSnapshot.ts` → `runScan` → `analyzeStock`.
3. `app/lib/learning/stockAnalyzer.ts` → `fetchYahooChart` fetches Yahoo chart API `1d/5m` and `3mo/1d` in parallel. Prefers intraday 5-minute bars; if unavailable, falls back to daily bars. `currentPrice` is the last candle close, with `latestBarTimestamp` and `dataSource` attached to the analyzed stock.
4. `app/lib/learning/dailySavePriceSourceAudit.ts` summarizes intraday vs daily_fallback, candle age, stale dates, and cache age. It explicitly warns that Yahoo candle time is not proof of finalized exchange close. This is passive diagnostic data, not a market-data certification.
5. `app/lib/dailyLearning.ts` persists the stock's `price` and score, but does **not** persist per-row upstream `dataSource` or `latestBarTimestamp` in `daily_stock_results`. Thus older rows cannot be retroactively assigned an upstream source solely from their saved price.

## Critical interpretation
The current WIN/LOSE/HOLD next-session comparisons are comparisons of two internally saved scan prices. These prices can originate from Yahoo intraday candles or Yahoo daily fallback, potentially with different timestamps and cache ages. They are **not automatically official JPX closing-price comparisons**. This does not establish that any individual saved price is wrong.

## Proposed independent Standard-plan verification
- Keep original prediction price, score, date, WIN/LOSE/HOLD and provenance immutable.
- In separate owner-only research, match stock code and original trade date to appropriately licensed J-Quants daily OHLC with verified trading calendar, price basis and corporate actions.
- Calculate +5/+10/+20 *trading-session* close-to-reference returns separately; distinguish original snapshot-to-future close from official close-to-future close to avoid mixed price bases.
- Record coverage, unmatched symbols, absent sessions, adjustment issues, and future-not-yet-matured as unverified; no invented success.
- Evaluate chronological holdout before any AI score change; no live J-Quants call, production writes or notification changes until licensing is confirmed.

## Status
Source-code lineage confirmed; no live feed or DB row inspection, no J-Quants request, no performance improvement established.
