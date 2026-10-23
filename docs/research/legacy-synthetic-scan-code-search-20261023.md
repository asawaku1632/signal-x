# Legacy synthetic scan: code-search findings (2026-10-23)

**Scope:** read-only GitHub default-branch code search and selected `main` files. Search results are not exhaustive proof of no consumers. No production endpoint was called.

- GitHub code search for exact `/api/cron/scan`: **no results returned**. A zero-result search is not proof of absence; search indexing and tokenization may affect results.
- Search for `signalxScanCache`: returned only `app/api/cron/scan/route.ts`, where the route uses its own in-process cache.
- Search for `1000銘柄対応テスト用データ`: returned only the same legacy route. It explicitly returns synthetic values.
- `vercel.json` in `main`: no scheduled entry for `/api/cron/scan`.
- `next.config.ts` in `main`: no rewrites/redirects routing traffic to the legacy endpoint; only service-worker-specific headers and dev origins.
- Attempted fetch of `middleware.ts` and `src/middleware.ts`: both 404 at checked ref; this does not exclude other request guards or proxy files.
- `app/api/scan/route.ts` uses `scanSnapshot` and `refreshScanSnapshot`, not the legacy synthetic route.

**Assessment:** no evidence yet of code-level consumption or direct Vercel cron scheduling of the synthetic route. Production reachability, externally scheduled invocations, actual traffic, and non-indexed code paths remain unverified. Do not treat the route as harmless or in use without further evidence.

**Next safe checks:** inspect deployed routing and exact-path request logs using read-only Vercel metadata, and inspect alternative proxy/request guards; do not call GET endpoints for reachability testing, since some routes can have side effects. If any real exposure or consumer is found, prepare isolated remediation and regression tests, then separately review before deploying.

**Unchanged:** no data collection, provider calls, billing, database writes, production code changes, or deployments.
