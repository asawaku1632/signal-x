# Chart / alert consistency fix

## Confirmed production target

- Android TWA host: `signal-x-ppjg.vercel.app`
- Vercel project to inspect for Android production: `signal-x-ppjg`
- Do not confuse it with the separate `signal-x` project.

## Result notification context

A favorite monitor stores its own entry price, take-profit and stop-loss values. When that historical signal reaches WIN/LOSE, the result notification must not open the ordinary analysis page as if that page represented the same signal.

This branch changes Web Push result notifications to open `/alerts/result/[code]` with the monitor snapshot embedded in the URL. The result page explicitly separates:

- historical signal result
- entry price
- result price
- take-profit / stop-loss lines
- signal and completion timestamps
- links to the current AI analysis and current chart

This prevents a LOSE notification and a current "buy candidate" analysis from appearing to contradict each other.

## Chart freshness finding

`/api/chart/[symbol]` currently uses a display snapshot with `CHART_FRESH_MS = 60_000`. When a snapshot is older than that, the route returns the stale snapshot immediately and refreshes it asynchronously with `after()`. The chart page fetches the API when the page/timeframe changes, but does not continuously poll it.

For intraday timeframes this means an already-open screen can remain old, and the first request after the snapshot becomes stale can still receive the previous snapshot.

## Required chart change before production

Do not patch production directly. The safe implementation should be tested on Preview first:

1. For intraday timeframes (`5m`, `15m`, `1H`), synchronously refresh a stale snapshot before returning it; if upstream refresh fails, fall back to the existing snapshot and mark it stale.
2. Add lightweight client polling while an intraday chart is open (target: about 60 seconds), without resetting zoom/scroll unnecessarily.
3. Return and display `updatedAt` plus the last candle date/time so the user can tell exactly how fresh the chart is.
4. Keep daily/weekly/monthly snapshot behavior conservative to avoid unnecessary Yahoo requests.
5. Verify on `signal-x-ppjg` Preview before merging or promoting to Production.
