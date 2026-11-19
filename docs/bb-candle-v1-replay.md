# BB_CANDLE_V1 offline J-Quants 5m replay (2026-11-19)

This is a **draft PR, not production**. It uses the same existing capture file shape and strict minute-vs-daily reconciliation as `fourPatternJQuantsBridge.mjs`, plus official consecutive TSE session checks. No remote request, new key, DB, cron, push, scoring, or orders.

## Run on user's Windows PC against an already captured private archive

From the repository root, after checking out the research branch:

```powershell
node --test tests/bbCandleV1.test.mjs tests/bbCandleReplay.test.mjs
node .\scripts\research\run-bb-candle-replay.mjs .\.private-research\four-pattern-jquants-3762-2026-10-06-2026-11-04.json
```

Multiple matching-date archives can be passed as separate arguments. **Do not commit, upload, paste, or share J-Quants raw archives or API keys.** A locally missing archive cannot be reconstructed from a GitHub PR. No authenticated request is made by this runner.

## Evaluation contract and caveats

- Signal from completed 5m candle; 20-bar BB, ±2σ breakout, expanding relative width and rising/falling center plus the 4 candle shape predicates. The shape thresholds are **independent research hypotheses**, NOT vendor proprietary rules.
- Slot `09:20` means a signal on a bar **ending at 09:15 or earlier**, followed by one full five-minute decision buffer (the 09:15 bar), then hypothetical 09:20 bar OPEN entry. Slots `11:20` and `14:15` follow the same rule (signals on 11:10 and 14:05 starting bars). This avoids using an unfinished signal bar to price an earlier trade, but historical data still cannot prove live availability, latency, or fills.
- Requires all 5-minute windows observed for complete-day comparison. Intraday no-trade minute records are not fabricated; entire missing five-minute windows are excluded. Cash close reflects auction. Complete source chain must reconcile against official same-code daily OHLCV.
- Uses same calendar-verified dates for all stocks. Missing intervening trading day blocks the whole comparison.
- Replays SELL directions for descriptive research; summaries focus on BUY. Hypothetical 0.1% slippage each way and 100 shares; no tax, brokerage charges, best bid/ask, halt, tick-size rounding, or queue-aware fill. Outcomes are not realized P&L.
- Signals with multiple pattern labels on same code/date/slot count **one event**. Repeated code/day signals at different slots and across dates may be correlated. Minimum 30 events per category before headline rate reported.
- Returns an aggregated report only. No raw prices, raw licensed bars or per-event rows are printed.
- For 1/3/5 trading-day end points, sample counts are always shown; win rate and average net return are withheld below 30 matured events per slot/horizon. Past-tense simulations, not forward evidence.
- Compared with the existing SIGNALX strategies, stronger evidence requires matched same code/date/time cohort and point-in-time stored existing signal snapshots. A retrospective after-close archive cannot certify the historical availability of a 9:20 live signal.

Current status: **code prepared, not locally tested against user's private historical data**, no real-stock statistical performance claimed. Existing production unchanged.
