# BB_CANDLE_V1 stitched per-stock historical sample (research only)

Why: the first broader multi-stock **same-date-cohort** audit correctly handled 67 private source archives but excluded singleton cohorts from outcomes, and therefore omitted the independently verified 8053 Oct 27 five-day loss. These are different analysis populations and must not be silently interchanged.

New `scripts/research/bb-stitch-stock-captures.mjs` reads the same already-retained local files and:
1. Reconciles complete captured 1-minute and daily price pages separately for **every** stock/day.
2. Requires exact 1-minute OHLCV and turnover agreement for each duplicate code/date appearing in more than one capture, refusing any conflict.
3. Deduplicates same-stock dates, splits into maximal **continuous TSE trading-session** runs, rejects unverified gaps, and replays those runs of 2–35 days. One-day runs cannot generate the replay's entry-slot outcomes, and are counted as skipped.
4. Assigns TOPIX regimes from the previously completed five index sessions only. Unknown benchmark history yields no classified event.
5. Deduplicates signal identities `code|date|slot` with a hard failure on repetition. Outputs dates, codes, hypothetical outcomes, maturity and count of observed multi-stock same-slot signals. No independent market-wide coverage claim or comparative win rate.

As an integrity check, the expected Oct 27 **8053** -6.7667% mature 5-day return should reappear when its Oct 27..29 and Oct 28..Nov 4 archives have matching overlapping minute data. An output that differs from the previous independent 8053 replay needs investigation, not a silent correction.

Run in the existing research checkout:
```powershell
Set-Location "C:\Users\neomo\signal-x-minute-research"
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "GIT_PULL_FAILED" }
node --test tests/bbStitchStockCaptures.test.mjs tests/bbWiderSampleAudit.test.mjs tests/bbCandleReplay.test.mjs
if ($LASTEXITCODE -ne 0) { throw "STITCH_TEST_FAILED" }
node .\scripts\research\bb-stitch-stock-captures.mjs `
".\.private-research\bb-candle-topix-20260925-20261104.json" `
"C:\Users\neomo\signal-x-four-pattern\.private-research" `
"C:\Users\neomo\signal-x-earnings-research\.private-research"
```

No J-Quants API calls, licensed raw OHLCV in output, external services, data writes, broker interactions, production changes or notifications. Unit tests authored but not yet executed on user's Windows machine. The selected historical capture universe changes by date; **do not infer** that a 7-stock same-slot result represents the entire market. This backtest does not justify an executable trade filter.
