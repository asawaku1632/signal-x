# All observed BB_CANDLE_V1 multi-pattern candidates, including censored outcomes

Purpose: falsification-first check of the retrospectively discovered Nov 4 **ENGULFING + MARUBOZU** co-occurrence. The latest local aggregation reported three instances, all Nov 4, with positive 5d hypothetical results. That is **one signal date**, not three independent date replications.

Unlike the mature-only nine/fifteen-event audits, this script reconstructs the **entire stitched BUY-event population** and independently re-detects pre-entry pattern labels from reconciled, complete five-minute bars. It checks each unique `code|date|slot` against the existing full historical classified BUY baseline. It **includes pending five-day events** and prints which other dates (if any) contain the same simultaneous two pattern labels, plus their outcome-maturity status. No positive-only filtering; no threshold fitting; no future data in patterns. Pre-entry bar completes at 09:15, 11:15 or 14:10 as applicable.

Run only on user's local PC with private archives:
```powershell
Set-Location "C:\Users\neomo\signal-x-minute-research"
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "GIT_PULL_FAILED" }
node --test tests/bbAllPatternOccurrences.test.mjs
if ($LASTEXITCODE -ne 0) { throw "PATTERN_OCCURRENCE_TEST_FAILED" }
$result = node .\scripts\research\bb-all-pattern-occurrences.mjs `
  ".\.private-research\bb-candle-topix-20260925-20261104.json" `
  "C:\Users\neomo\signal-x-four-pattern\.private-research" `
  "C:\Users\neomo\signal-x-earnings-research\.private-research" `
  ".\.private-research"
if ($LASTEXITCODE -ne 0) { throw "PATTERN_OCCURRENCE_REPLAY_FAILED" }
$data = $result | ConvertFrom-Json
if ($data.status -ne "BB_ALL_OBSERVED_PATTERN_OCCURRENCES_ONLY") { throw "BAD_AUDIT_STATUS" }
Write-Host "TOTAL=$($data.total.observedEvents)"
Write-Host "MATURE=$($data.total.mature5d)"
Write-Host "PENDING=$($data.total.pending5d)"
Write-Host "COMBINED_COUNT=$($data.combined.observedEvents)"
Write-Host "COMBINED_DATES=$($data.combined.distinctDates)"
Write-Host "OUTSIDE_NOV4=$($data.outsideNov4.observedEvents)"
$data.combinedEvents | Select-Object date,slot,code,patterns,after5dPct | Format-Table -AutoSize
Write-Host "RESEARCH_ONLY=TRUE"
Write-Host "PRODUCTION_UNCHANGED=TRUE"
```

No J-Quants API calls, file writes, secrets, orders, notifications, or prod changes. Report's absence of examples outside Nov 4 would describe **only this selected local archive**, not the market overall, and a date shared across stocks does not independently validate a profitable pattern.
