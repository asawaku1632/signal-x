# Bollinger squeeze breakout vs failed breakout (SHADOW ONLY)

Status: research code only. This branch does not start live verification. A source-code commit is not proof that scheduled accumulation, database tracking, or evaluation is operational.

## Existing foundations
- BB20 observation, ±2σ / ±3σ, crossing and return-inside event capture already exist.
- Existing chart pattern045 detects BB squeeze. Other BB research has future-result evaluation and a distinct DEV Phase 7/8 workflow.
- The Phase 7/8 DEV workflow has separate review and approval boundaries. Do not run its DEV connection, evaluations, writes or deployment here.

## Comparison
Standalone: app/lib/research/bollingerBreakoutShadow.mjs

Compare the same upper 2σ breakout event:
- SQUEEZE_UP_BREAKOUT: prior-day BB20 band width <= 25th percentile of 60 earlier completed widths.
- OTHER_UP_BREAKOUT: identical crossing rule without prior squeeze.

On signal day t, close > prior day's upper 2σ while close on t-1 <= upper 2σ on t-2. All needed data for the signal are frozen at t (80+ ordered valid daily bars). The volume ratio uses t volume / mean t-20..t-1 volume, with 1.3x as research-only confirmation and unavailable input as NULL.

Evaluate 1/3/5 trading sessions forward using t+1 OPEN as the simulated entry (not t close). Retrospective return-inside means t+1 close below its own t+1 upper 2σ band. This outcome is NEVER a t-day signal feature.

Publish mean return, positive share and adverse excursion only after >=30 complete events in a cohort. Pending and invalid periods stay unevaluated. Duplicate stock code + signal time is rejected.

## Limitations
- The eventual consumer must enforce trading-calendar continuity, split/corporate-action handling, market closures and full-source provenance. The module does not claim realistic fills, account for slippage/fees, or guarantee an executable opening price.
- Repeated events in the same stock may be correlated; count and report that separately.
- Intraday 09:05 vs 11:00 entry requires a distinct time-stamped paired study; daily BB alone cannot measure it.
- This addition is not an automated scanner or observation writer.

## Offline test
Run: node --test tests/bollingerBreakoutShadow.test.mjs

## Production separation
NO modifications to production AI POWER, buy/sell decisions, notifications, rankings, trades, Vercel cron, DB schema, API routes, or environment variables. The standalone research consumer is deliberately not connected to any live scheduler or database. Separately review and authorize a read-only adapter to immutable completed daily candle archives before real forward samples are recorded.
