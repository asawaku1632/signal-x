# Four Pattern Shadow Research (v1)

Owner-only, opt-in comparison for four unproven hypotheses, independent of AI POWER, trades, production alerts and databases.

## Admin UI

Page: /admin/four-patterns-shadow (linked from /admin/learning-hub).

* The owner signs in, enters 1–5 distinct four-digit TSE codes, and presses the button.
* Only completed daily Yahoo reference candles are fetched. No initial fetch, cron, writes, or broad-market scan.
* If a source has missing volume, insufficient bars, bad chronology, or an extreme unadjusted gap, it fails closed.
* Quality-pullback never fires from this page because no timestamped financial snapshot is currently supplied.

## Offline intraday study

The engine supports pre-aggregated, fully closed 30m and 60m candles, which must be supplied from a separately audited source (e.g. captured J-Quants minute archives).

Run:

    node scripts/research/run-four-patterns-shadow.mjs /path/to/archive.json

Example input structure (not sample prices or verified market evidence):

    {
      "code": "7203",
      "timeframe": "30m",
      "candles": [
        {"time": 1790000000, "open": 100, "high": 101, "low": 99, "close": 100, "volume": 1000}
      ],
      "fundamentals": [
        {
          "publishedAt": 1780000000,
          "revenueGrowthPct": 8,
          "operatingProfitGrowthPct": 12,
          "equityRatioPct": 50,
          "operatingCashFlowYen": 100000000
        }
      ]
    }

Provide at least 80 valid, chronologically ordered bars for an actual calculation. The single candle above is only a schema illustration. Epoch timestamps are seconds, not milliseconds. Candle timestamps must be assigned consistently to fully closed bars, never an unclosed candle. Financial publishedAt is the information-availability timestamp, not period-end or data-import time; later financial statements are never used for earlier signals. These values and source claims are not independently authenticated by the engine.

Timeframe-specific holding horizons:
* 1D: 1, 3, 5 trading sessions. Signal at daily close, next session open hypothetical entry, respective session close hypothetical exit.
* 30m and 60m: 1, 3, 5 bars, NOT trading days. No contemporary 09:05 or 09:15 feed is implied.

Outcomes are separate counterfactual scenarios; they are not realized profit-and-loss or an executable stop-order simulation.

## Hypotheses (deliberately fixed for v1)

1. Horizontal resistance: preconfirmed independent highs + volume breakout, retest in five bars, bullish confirmation above old resistance.
2. EMA compression: previous EMA9/21/50 spread <=1.6%, then a close above the prior 12 bars' highs and relative volume >=1.2.
3. Higher low: two preconfirmed local lows at least five bars apart, second 0–5% higher and bullish follow-through.
4. Quality pullback: supplied as-of published revenue and operating profit growth both >=5%, equity ratio >=30%, positive operating cash flow, historical peak-to-low drawdown 7–25%, upward 75-bar MA and recovery above EMA9.

These thresholds are research hypotheses, not optimized, validated signals or probability estimates.

## Safety and interpretation

* Deterministic code and signals only inspect bars up to their own signal bar. Outcomes use later bars only after signals are frozen.
* Missing data, zero observations and uncompleted five-bar forward horizons cannot be presented as 0% winning rates.
* Five-bar win-rate summary is restricted to entry cost <=500,000 yen for 100 shares. Hypothetical slippage 0.1% on each side. Tax, fees, limit-up or execution constraints not modeled.
* Overlapping signals of the same stock/strategy within five bars are de-duplicated. Results can still be correlated.
* No selected-universe or historical survivorship bias control, not out-of-sample proven; source rights and real-time availability are not independently checked.
* Actual timestamped fundamentals, verified J-Quants minute aggregation/source capture, and forward 1/3/5 day tracking are separate integrations; none is silently claimed to be completed.
* No production notification, daily AI score, automated buy/sell, brokerage integration or research DB mutation is performed.

Run the tests:

    node --test tests/fourStrategyShadow.test.mjs
