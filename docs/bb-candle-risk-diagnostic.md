# BB_CANDLE_V1 risk diagnostics, version 1 (SHADOW ONLY)

Objective: compare *pre-entry* characteristics of mature 5-day profitable vs unprofitable BUY observations without inventing an optimized trade filter. The previous user's verified historical research yielded 3 stock codes (3762, 7203, 7752; nine BUY signals, six 5-day mature) plus 8053 (two BUY signals, one 5-day mature after strict overlap validation). Thus the new diagnostic cohort is expected to have 11 BUY observations, **only seven 5-day mature**. These are not 11 independent trials and may be correlated with the overall market or selection process.

Inputs, all **local / ignored** private files:
- Previously captured TOPIX 2026-09-25..11-04 validated daily closes.
- Original 3762, 7203, 7752 archives covering 2026-10-06..11-04.
- Existing 8053 Oct 27..29 and Oct 28..Nov 4 archives. Duplicate Oct 28 and 29 *reconciled minute OHLCV+turnover* must match exactly before an in-memory merge. No archive is changed.

Features from only the *completed signal bar or earlier*:
- `priorTopix5dPct`: official TOPIX previous **completed five TSE session** return. Not intraday market data, and is NOT existing SIGNALX AI market score.
- `bbWidthPct`: BB20 ±2σ full width divided by middle at signal close.
- `volumeVsPrior20`: signal 5-min candle share volume divided by average of the preceding 20 **completed** 5-min candles; not a comparable market-wide turnover score.
- `bodyToRangePct`: candle body size / high-low range on completed signal candle.
- `last5BarsPct`: signal close / 5 earlier 5-minute closes minus one.

**Outcomes only for retrospective descriptions:** existing replay's 5-day cost-adjusted hypothetical percent return and worst within-horizon adverse percentage; not used in feature construction. Missing 5-day results remain `NOT_MATURE`.

Run from `C:\Users\neomo\signal-x-minute-research`:

```powershell
git pull --ff-only
node --test tests/bbCandleRiskDiagnostic.test.mjs tests/bb8053Overlap.test.mjs tests/bbCandleReplay.test.mjs
if ($LASTEXITCODE -eq 0) {
    node .\scripts\research\bb-candle-risk-diagnostic.mjs `
      ".\.private-research\bb-candle-topix-20260925-20261104.json" `
      "C:\Users\neomo\signal-x-four-pattern\.private-research\four-pattern-jquants-3762-2026-10-06-2026-11-04.json" `
      "C:\Users\neomo\signal-x-four-pattern\.private-research\four-pattern-jquants-7203-2026-10-06-2026-11-04.json" `
      "C:\Users\neomo\signal-x-four-pattern\.private-research\four-pattern-jquants-7752-2026-10-06-2026-11-04.json" `
      "C:\Users\neomo\signal-x-earnings-research\.private-research\four-pattern-jquants-8053-2026-10-27-2026-10-29.json" `
      "C:\Users\neomo\signal-x-earnings-research\.private-research\four-pattern-jquants-8053-2026-10-28-2026-11-04.json"
}
```

No win-rate estimates, no strategy tuning, no trading approval, no new API requests, no production integration. Feature comparisons are **descriptive only**, and applying any new cutoff to these same examples would overfit. To validate a filter, preregister the candidate rule on separate untouched future dates, with broader market regimes and enough samples.
