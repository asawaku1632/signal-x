# BB_CANDLE_V1 — Japanese stock BB × four-candle shadow study

Status: **offline research branch only**. No production scoring, notifications, rankings, orders, database, cron, migrations or vendor calls. This is an independently defined hypothesis based on public descriptions, not a reproduction of purchased proprietary indicator settings.

- Input: strictly ascending *completed* OHLC bars (typically Japanese equities 5-minute candles), fixed same symbol/timeframe and valid prices. Caller must additionally validate market sessions, exchange calendar, suspension, corporate actions, stale data, and consistent provider.
- BB: 20 closes, population standard deviation, ±2 sigma. Trend UP when current close > current upper band, middle rises, and relative 2σ width expands above 0.4%; DOWN symmetric. RANGE otherwise. These are V1 definitions, not a claim that all ±1/±2/±3 lines exactly match the seller's unspecified expansion rule.
- MARUBOZU: directional body/range >=80%. PIN_BAR: body/range <=35%, long countertrend wick >=55% and directional close. ENGULFING: opposite previous candle with current real body enclosing previous body. DOJI_BREAK: previous body/range <=10% then close beyond previous high/low. All require same-direction BB trend. SELL is a directional analytical observation, not an instruction to short Japanese equities.
- Zero-range or insufficient history is skipped. Invalid/unordered series throws. No intra-bar or anticipatory signals. Adjacent signals may overlap and must not be treated as independent outcomes.
- Offline outcomes: signal-close to future close is **hypothetical**, not fillable at signal close. Report statistics only after 30 mature observations per type/horizon. Future studies should compare next valid 5-minute bar OPEN execution with spreads, slippage, costs, gaps, maximum adverse excursion, liquidity and trade restrictions.
- Planned comparison: 09:20 / 11:20 / 14:15 JST, 5-minute sessions and subsequent 1/3/5 trading-day returns, plus no-BB baseline / BB-only / pattern-only / combined. Do NOT interpret future candle counts as trading days without a separate exchange calendar.
- No results on actual stocks have been measured by these source-only tests.

Offline test: `node --test tests/bbCandleV1.test.mjs`
