# BB_CANDLE_V1 5-TSE-session missing-date inventory (read-only)

Motivation: user-confirmed 67 locally saved J-Quants archives, 45 distinct stocks, 22 classified BUY signals, **7 complete 5-day scenarios and 15 pending** after per-stock stitching. This step produces a finite missing-date manifest BEFORE any API capture decisions. The missing date count is not the same as API request count or fee and does not establish subscription access.

Algorithm: re-run the independently validated `auditStitchedStocks` using all 67 existing private captures, then for each currently pending BUY event resolve its exact next five Tokyo Stock Exchange sessions from the project's explicit 2026–2027 JPX calendar. Compare each stock/date against all locally captured days, not merely the small original archive. Require the source signal date to exist; fail closed if the baseline says pending despite all five following dates already existing. Deduplicate proposed missing code+date pairs across overlapping signal windows. Sort event results by observed same-slot stock count (high first), then missing days (low first), date and code. This is for inspection only and does not automatically import or fetch anything.

```powershell
Set-Location "C:\Users\neomo\signal-x-minute-research"
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "GIT_PULL_FAILED" }
node --test tests/bbMissingFiveDays.test.mjs tests/bbStitchStockCaptures.test.mjs tests/bbWiderSampleAudit.test.mjs
if ($LASTEXITCODE -ne 0) { throw "MISSING_DAYS_TEST_FAILED" }
node .\scripts\research\bb-missing-five-days.mjs `
".\.private-research\bb-candle-topix-20260925-20261104.json" `
"C:\Users\neomo\signal-x-four-pattern\.private-research" `
"C:\Users\neomo\signal-x-earnings-research\.private-research"
```

Output: `pending5d`, `missingBySignal` (code, signal date/slot, group size, 5th-session exit date, missing dates), `distinctMissingStockDates`, `uniqueMissingStockDates`. Only dates and codes leave the local script, not licensed raw OHLCV or keys.

Do NOT trigger further paid API requests before analyzing this output, plan limits, and provenance. Do NOT treat the 22 observations as a full-market sample or fit trading filters to these observations. Missing market-regime classifications after last TOPIX date (2026-11-04) mean some signal candidates are deliberately out of scope and need separately validated TOPIX history.

Research only, no network, writes, database, live app changes or notifications.
