# STEP 33 — Manual-save origin protection

Implementation commit: 8cd67276266c90320b98d71311d37081f5c5312a (research branch only).

The existing preview-only admin POST in `app/api/admin/market-index-research/route.ts` now rejects requests whose `Origin` does not exactly match the request URL origin. This mirrors the separate commit/retry test handler. Admin session, preview environment and dev DB identity guards remain in place.

Verification: source change committed. Preview deployment/build, real request testing and same-origin behavior are **NOT YET VERIFIED**. No production changes.
