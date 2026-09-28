# Verification plan

1. Open an existing stock performance page and confirm the original AI performance sections still render.
2. Confirm a clarification card states that the legacy cumulative P/L is a 100-share next-day learning metric, not account profit.
3. Confirm the 100,000-yen simulation card loads independently; a simulation API failure must not break the original page.
4. Cross-check `currentCapital = 100000 + realizedProfitYen`.
5. Cross-check every executed trade has score >= 85, 100 shares, and sufficient capital at entry.
6. Cross-check skipped-insufficient-funds count for prices above available capital / 100.
7. Confirm the UI discloses next-business-day exit, fees/tax/slippage exclusion, and that this is not yet a take-profit/stop-loss backtest.
