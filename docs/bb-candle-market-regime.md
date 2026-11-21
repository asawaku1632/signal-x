# BB_CANDLE_V1 × 市場環境（研究専用）

Existing SIGNALX `marketLearning` defines a score-driven marketTrend, but historical storage alone cannot certify when an old score became available. This independent study **does not reinterpret or silently reconstruct that score**.

Instead, a separately supplied verified historical **TOPIX** (preferred) or **Nikkei225** daily closing series is used for a strictly prior-session market-trend proxy. The previous completed close versus five JPX sessions earlier gives:
- UP: previous five-session index return >= +1%
- DOWN: <= -1%
- SIDEWAYS: between -1% and +1%
- UNKNOWN: missing prior 6 observations or a missing immediately prior trading session.

These are fixed exploratory thresholds, NOT SIGNALX's existing market score classifications. Series dates must include every JPX session across the provided range, with at least 6 closes **before** the earliest trade date. The input is local JSON:

```json
{
  "benchmark": "TOPIX",
  "closes": [
    {"date": "YYYY-MM-DD", "close": 1234.56}
  ]
}
```

The above single row is a schema illustration, **not verified TOPIX data**. Never fabricate the values. Use only lawful source data with accurate dates and provider documentation. Inputs are not fetched by this module and must be supplied separately.

After locating or generating a *verified* local benchmark series with enough lookback, run from repository root (one or more same-date J-Quants archives):

```powershell
node .\scripts\research\run-bb-market-regime.mjs "C:\path\to\verified-topix-closes.json" "C:\Users\neomo\signal-x-four-pattern\.private-research\four-pattern-jquants-3762-2026-10-06-2026-11-04.json"
```

Each BUY event is labeled against only the previously completed benchmark closes, and the 1/3/5-day outcomes remain retrospective. Rates and means are withheld per category until at least 30 mature events, 15 distinct trade dates and 10 distinct stocks. No inference from this one 3-stock cohort. Benchmark level classifications are NOT an entry-time market prediction.

Offline tests:
`node --test tests/bbMarketRegimeV1.test.mjs`

No production feature, notifications, scheduled tasks, broker calls, DB or secrets. Never commit licensed raw private archives or API keys.
