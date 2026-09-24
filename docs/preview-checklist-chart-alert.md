# Preview verification checklist: chart + alert consistency

Run this checklist on the `signal-x-ppjg` Preview deployment for `fix/chart-freshness-notification-context` before merging.

- Result Web Push opens `/alerts/result/{code}` rather than the ordinary analysis page.
- LOSE page shows the historical entry price, result price, take-profit and stop-loss used by that monitor.
- WIN page shows the same historical context.
- The page states that the historical result is separate from the current AI evaluation.
- `現在のAI分析` opens `/analysis/{code}`.
- `最新チャート` opens `/chart/{code}`.
- Existing favorite monitor cron authentication and LINE delivery behavior remain unchanged.
- Android traffic is checked in Vercel project `signal-x-ppjg`, not `signal-x`.
- Do not merge the chart freshness implementation until intraday stale-snapshot behavior and polling are verified on Preview.
