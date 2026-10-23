# Legacy synthetic scan endpoint: read-only isolation audit (2026-10-23)

Status: **REVIEW REQUIRED; no production change**.

## Evidence from main branch
- `app/api/scan/route.ts` is a genuine scan entrypoint. It reads `scanSnapshot`, refreshes via `refreshScanSnapshot`, and returns snapshot-backed stocks; its upstream analyzer was separately traced to Yahoo chart reads. This does **not** prove market-data licensing.
- `app/api/cron/scan/route.ts` defines a GET handler that returns deterministic **synthetic** values: `price: 1000 + Number(code.slice(-2)) * 10`, `calcAiPower` based on the last two ticker digits, constant `changeRate=0`, `volumeRate=1`, `rsi=50`, and `reason: 1000銘柄対応テスト用データ`. Its 50-stock hardcoded list is not an actual ~950-stock scan. Never use it for market research or as evidence of real quotes.
- `vercel.json` contains many scheduled cron paths but **does not include** `/api/cron/scan`. This rules out a direct schedule from this checked-in file only; it does not rule out external callers or another scheduler/configuration.
- The legacy route's shown GET implementation does not check authentication. Its deployed reachability, traffic, middleware, external call sites and downstream consumers remain **UNVERIFIED**. Do not claim it is publicly reachable or actively consumed until checked.

## Risk and safe follow-up
1. Search code references to `/api/cron/scan` (exact path), and inspect `middleware.ts`, `next.config.*` and deployment routing. Use read-only repository inspection.
2. Review production request logs and Vercel cron inventory for the exact endpoint **without making a request to it**. Some GET routes may cause side effects; do not test production by calling endpoints.
3. Confirm no research table, dashboard, ranking, alert or historical evaluation consumes its synthetic payload. Treat unknown consumers as unverified.
4. If it is deployed and unauthenticated, prepare a separate isolated remediation with regression tests and explicit deployment review. Do not delete or modify the legacy endpoint blindly.
5. Keep the frozen afternoon rebound study isolated; never source its observations from the synthetic endpoint.

No API calls to market providers, database writes, cron changes, billing changes, or production deployment were made as part of this audit.
