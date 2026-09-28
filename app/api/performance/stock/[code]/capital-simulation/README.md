# Capital simulation acceptance checks

- `score < 85`: no trade.
- `score >= 85` and `price * 100 > capital`: insufficient-funds skip.
- `score >= 85` and affordable: buy 100 shares at saved price and sell all at next business-day price.
- Profit/loss is rolled into the next trade's available capital.
- No margin, no additional deposits, no fractional/odd-lot shares.
- Pending/UNKNOWN rows are excluded.
- Fees, tax and slippage are intentionally excluded and disclosed in the API/UI.
- The result must not be described as a take-profit/stop-loss backtest until historical price-path data is available.
