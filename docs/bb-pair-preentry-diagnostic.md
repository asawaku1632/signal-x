# BB_CANDLE_V1: 2026-11-04 14:15 selected pair, frozen pre-entry features

**Research / historical scenario only. Do not deploy as a strategy or use as advice.**

The previously user-run strict stockwise replay completed 9 of 22 historical BUY events from 69 saved licensed J-Quants archives. Same-date same-slot 2026-11-04 14:15 two members of a **seven-stock observed** cluster had opposite five-session hypothetical outcomes:
- 6326: -3.5519%, worst adverse five-session -10.0899%.
- 8410: +3.4245%, worst adverse -1.1617%.

This script shows whether differences in *available at the completed 14:10 signal bar* could generate future **untuned hypotheses**: completed 5m Bollinger width %, signal bar volume / previous 20 completed 5m bars mean volume, candle body/range %, and current-close vs five bars earlier %. It shows pattern types already detected, but does not retrospectively alter candidate selection.

The pre-entry features reuse the same frozen `detectBbCandleV1` and `featuresAtCompletedSignal` as the existing risk diagnostic. The 14:15 execution slot is modeled from a completed 14:10 signal candle with a five-minute buffer. The signal and all prior bars are historical as-captured data, not proof the candles were available in real time.

The audit rechecks 69 archives' daily/minute reconciliation and stockwise historical outcomes, stitches each code across overlapping dates only after full minute equality, requires all five after-signal TSE sessions, and insists that both codes are present in the observed seven-security 14:15 group. If either outcome is absent, conflicting, or the signal is not independently detected with correct 14:10 bar time, it fails closed. **No 75-trading-day moving average position is calculated** because the saved five-minute capture does not constitute a valid 75-day adjusted daily-price history. Do not silently substitute intraday data for MA75.

Local run:

```powershell
Set-Location "C:\Users\neomo\signal-x-minute-research"
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "GIT_PULL_FAILED" }
node --test tests/bbPairPreentryDiagnostic.test.mjs tests/bbStitchStockCaptures.test.mjs tests/bbCandleRiskDiagnostic.test.mjs
if ($LASTEXITCODE -ne 0) { throw "PAIR_DIAGNOSTIC_TEST_FAILED" }
node .\scripts\research\bb-pair-preentry-diagnostic.mjs `
".\.private-research\bb-candle-topix-20260925-20261104.json" `
"C:\Users\neomo\signal-x-four-pattern\.private-research" `
"C:\Users\neomo\signal-x-earnings-research\.private-research" `
".\.private-research"
if ($LASTEXITCODE -ne 0) { throw "PAIR_DIAGNOSTIC_REPLAY_FAILED" }
```

Do not share the API key, full licensed captures, OHLCV rows, or private folder contents. Only the derived small research report is printed. No API calls, no file writes, no access to broker, database, Vercel or production code. Findings must remain descriptive since n=2, selection is retrospective, independent market-day count is one, and same-slot historical outcomes cannot establish a robust trading classifier.
