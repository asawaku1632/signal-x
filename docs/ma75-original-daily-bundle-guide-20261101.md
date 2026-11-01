# Offline original daily J-Quants bundle audit (Draft PR #297)

This is for already captured original historical data ONLY. It does not contact J-Quants, read keys, buy an add-on, update Supabase, deploy an app, calculate validated forward returns, or send notifications.

## Input

Create a local JSON input with schemaVersion `ma75_original_daily_bundle_v1`, a `sessions` array of **exactly 76** ordered TSE stock-exchange session dates, a `dayPages` array of zero to 76 objects, and a separately retained raw `calendarSnapshot`.

Each `dayPages` object is `{date, pages}`. Every page must preserve `requestPaginationKey` (null for the first request), `receivedAt` (offset-aware ISO instant), and the original `response` containing `data` rows and any `pagination_key`. A date query is for the whole provider universe, not `code=XXXX`. Do not invent 953 matching stock rows, dates, page receipts or vendor identifiers. Never include credentials.

Provide `calendarSnapshot` with `requestFrom`, `requestTo`, `capturedAt`, and `records` using the original `Date` / `HolDiv` values including every calendar date, not only exchange trading dates. A corrected/revised calendar requires separate manual review.

Expected normalized four-character freeze: `docs/ma75-forward-cohort-freeze-20261031.json` (953 app-observed codes). The all-listed date-query projectors account for original source rows and exclude valid unrelated stock/class listings before independently parsing the original frozen 953-code population. Wrong-date codes, duplicate provider listings, duplicate frozen ordinary classes, unknown rights/adjustment metadata, bad daily OHLCV and pagination gaps are blocked. The projection is derived from original page envelopes; it is not a vendor-authenticated replacement for the original archive. All 76 source days and 953 code-days must reconcile before the hypothetical crossover count is shown.

## Local command

    node scripts/research/ma75-offline-daily-bundle.mjs --input=./research-private/original-pages.json --output=./research-private/original-pages-summary.json

Store the captured input privately and use appropriate J-Quants license terms; do not commit raw provider responses or credentials to GitHub. Output uses exclusive create and contains aggregate metadata only. The script never makes API requests.

## Interpretation

- The summary returns `structural76DayCoverage`, `missingDateCaptures`, `rejectedDateAudits`, `calendarIssues`, and code-status counts.
- `originalProviderRowsRecorded` includes all listings, while `projectedFrozenRowsRecorded` and `excludedUnselectedListingRows` disclose exact projection accounting. `hypotheticalOfflineCrossoverCount` is **null when coverage is incomplete**, avoiding a winners-only statistic.
- Even complete structural math has `validatedForwardWinRate: null`, zero validated forward outcomes and all production/notification/trading eligibility **false**.
- Independently licensed 76-session source, point-in-time capture, calendar, corporate actions, and held-out future P&L are still unverified.

Tests: `node --test tests/ma75OriginalDailyBundle.test.mjs`. The existing research branch workflow automatically executes `tests/ma75*.test.mjs`.
