# Research-only admin summary endpoint checkpoint

## Root cause and repair
Vercel Preview for commit 2bce992 was ERROR. Build logs showed `dashboard summarizes blocked inputs without including raw evidence` failed due to an incorrect expected blocked reason in the dashboard unit test. Commit c447410 changes the test to assert the fail-closed RIGHTS_CLAIM category and count, avoiding a brittle exact reason.

## New endpoint
`GET /api/admin/market-index-research/review-summary`:
- server-side `getAdminSession()` required; non-admin returns 403
- always `Cache-Control: no-store`
- read-only, no POST, no provider access, no DB access
- uses empty batch `buildResearchDashboardModel([])`
- `dataOrigin: NO_DATA_CONNECTED`, `dataIsLive: false`, research-only warnings and zero counters
- no synthetic records passed off as live data
- no page/UI wiring yet

## Release gate
New Preview test/build result not confirmed at the time of this checkpoint. Existing GitHub shadow CI run 40102213374 succeeded for previous commit, but that did not imply Preview success. No production/main changes or permanent dev DB writes. Dedicated eligibility workflow independently unverified.
