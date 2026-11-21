# November 4 BB_CANDLE_V1 seven-stock observed cluster: remaining five-stock data plan

Read-only planning for the five still immature 5-session results: 1945, 7203, 7752, 8316, 8601. Signal 2026-11-04 14:15. Two members already completed locally: 6326 -3.5519%, 8410 +3.4245%, both purely retrospective scenarios.

Exact next five TSE sessions: 2026-11-05, 11-06, 11-09, 11-10, 11-11. Existing missing-date inventory reported all five dates absent for all five remaining securities, so **25 stock-dates** would be needed for full 5-day post-entry adverse and ending returns. The capture script's existing maximum 4 minute pages and 4 daily pages per stock/date gives a conservative maximum **200 HTTP requests**. Actual page count and API cost/rights are separate questions. Each planned capture omits financial endpoints. No automatic HTTP is enabled.

To review the plan using current stored files:

```powershell
Set-Location "C:\Users\neomo\signal-x-minute-research"
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "GIT_PULL_FAILED" }
node --test tests/bbNov4FiveStocksCapturePlan.test.mjs
if ($LASTEXITCODE -ne 0) { throw "NOV4_PLAN_TEST_FAILED" }
node .\scripts\research\bb-nov4-five-stocks-capture-plan.mjs `
"C:\Users\neomo\signal-x-four-pattern\.private-research" `
"C:\Users\neomo\signal-x-earnings-research\.private-research" `
".\.private-research"
if ($LASTEXITCODE -ne 0) { throw "NOV4_PLAN_BLOCKED" }
```

The planner is intentionally **dry-run only** and compares currently available file coverage, not J-Quants permissions. It does not upload licensed OHLCV, call an API, store files, use the key, submit orders, enable notifications, or change production. If a previously missing stock-date now exists, it is removed from the retrieval plan. Review the output before any separate explicit capture. The completed group would remain seven selected historical stocks, not a representative market-wide sample, and cannot justify a filter.
