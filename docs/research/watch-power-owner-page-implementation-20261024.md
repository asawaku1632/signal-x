# Owner-only WATCH prospective holdout page — implementation review

Research branch draft PR #211 only. Added `app/admin/watch-power-holdout/page.tsx`.

- Uses existing `getLearningOwnerSession()` and `notFound()` before any database access. Does not use broad `ADMIN_EMAILS` authorization.
- Uses existing server-side `pg` pool. Parameterized SELECT only, columns `code`, `trade_date::text`, `decision_status`, `ai_power`, `return_5d`; post-freeze and WATCH filter.
- Fails closed when query errors or more than 20,000 records would need processing. No partial aggregates on truncation.
- Converts with `mapFrozenSwingRows` and calculates `getWatchPowerHoldoutReadiness`. Only reveals mean date-equal-weight difference after review-ready (>=10 comparable future dates, no conflicting duplicates).
- Displays missing outcome dates, incomparable dates, and conflicting duplicates. No cron, notification, public API, schema migration, or trading integration.

**Unverified:** Next.js build/typecheck, deployed owner login, DB access under deployed environment, and production data rendering. Do not merge or deploy before isolated preview tests and owner authorization. Link is not yet included in the learning hub navigation.
