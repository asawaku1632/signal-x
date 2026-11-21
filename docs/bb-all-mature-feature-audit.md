# BB_CANDLE_V1: all 5-session mature events pre-entry features

Purpose: extend selected-pair Nov 4 comparison to ALL mature historical BUY events in the 69-file locally stored selected capture sample. At time of preparation user verified 22 classified signal observations, 9 with 5-session maturity and 13 censored. These are not real trades.

Read-only script `scripts/research/bb-all-mature-feature-audit.mjs` reconstructs the full stitched replay, then independently redetects each mature signal using reconciled completed five-minute bars on each contiguous stock segment. Key is unique `code|date|slot`; a conflicting repeated signal bar is an error. Reported pre-entry features reuse the established `featuresAtCompletedSignal`: BB width %, signal completed 5m volume vs previous 20 completed 5m volumes, body-to-range %, and signal close vs five previous completed bars. The 09:20, 11:20, 14:15 entries use bars completed at 09:15, 11:15, 14:10 respectively. Future 5-session percent and maximum adverse move are separate **labels**, never feature inputs.

The descriptive worst-dip bins (<=-10%, (-10%,-5%], >-5%) are stated solely for organizing outcomes, NOT cutoff optimization. The independent trading date count is reported, as several outcomes are on the same date. Do not train any filter on nine already observed outcomes. No MA75 estimated from incomplete daily bars.

Run:

```powershell
Set-Location "C:\Users\neomo\signal-x-minute-research"
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "GIT_PULL_FAILED" }
node --test tests/bbAllMatureFeatureAudit.test.mjs tests/bbPairPreentryDiagnostic.test.mjs tests/bbStitchStockCaptures.test.mjs
if ($LASTEXITCODE -ne 0) { throw "MATURE_FEATURE_TEST_FAILED" }
node .\scripts\research\bb-all-mature-feature-audit.mjs `
".\.private-research\bb-candle-topix-20260925-20261104.json" `
"C:\Users\neomo\signal-x-four-pattern\.private-research" `
"C:\Users\neomo\signal-x-earnings-research\.private-research" `
".\.private-research"
if ($LASTEXITCODE -ne 0) { throw "MATURE_FEATURE_REPLAY_FAILED" }
```

No outbound API, no new paid capture, no persistence, secrets, private OHLCV in printed report, orders, alerts or production changes. Script is newly committed and **still awaits execution/test on user's Windows PC**. On unexpected results, stop and inspect rather than claiming comparative efficacy.
