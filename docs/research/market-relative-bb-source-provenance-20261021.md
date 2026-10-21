# BB source and forward-outcome provenance (2026-10-21)

Read-only GitHub source inspection and read-only development Supabase aggregates.

Source: `app/lib/learning/bbObservation.ts`
- `saveBbSignalEvents(signalDate, stocks)` writes `stock.code`, `tradeDate`, `stock.price`, `stock.aiPower`, and other BB fields to `bb_signal_events`.
- `tradeDate` is `stock.bollinger?.tradeDate ?? signalDate`. No independent exact signal-observation timestamp is included in this insert.
- `ON CONFLICT ON CONSTRAINT bb_signal_events_idempotency_key DO NOTHING` prevents duplicate rows for the configured event key. It does **not** prove the snapshot was recorded in real time.
- `evaluatePendingBbEvents` obtains Yahoo daily candles and writes future-price results for 1, 5, 10, 20 trading-day horizons. Daily-candle results must not be represented as exact 09:05 execution prices.

Development DB results:
- `bb_signal_events`: 425 events, of which 420 have four-digit stock codes.
- `bb_signal_event_results`: **5 result rows across 2 events**.
- Joining results to events: **0 results for four-digit stock codes**; all five results are linked to dev-only identifiers.

Therefore no observed market-relative performance can be calculated for the 420 ordinary-code BB events from these tables. Historical event creation timestamps were after signal dates, and an independently verifiable original signal-time artifact remains necessary before claiming prospective predictive accuracy.

Do not activate the BB evaluator, retroactively populate outcomes, or change production settings on the basis of this audit.
