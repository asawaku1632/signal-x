# Research dashboard model checkpoint (after STEP 320)

## Verified before changes
- STEP 320 commit 17ae4a4 Vercel Preview READY (dpl_5tL6qf5nvNnnV4a8kGycAQro5H4i).
- Preview logs show test-first npm build and Build Completed [44s]. Visible logs are partial, so exact test count not asserted.
- Existing shadow CI run 40101656636 success. Dedicated eligibility workflow independently unverified.

## New implementation
- Pure presentation model `app/lib/research/market-index-dashboard-model.ts`.
- Displays research-only state, candidate/blocked totals, reason-code breakdown, and three fixed warnings: rights unverified, exchange calendar unverified, persistence disabled.
- Rejects malformed or over-100 input; never emits raw provider/evidence/verifier identifiers.
- Added unit tests and included them in `test:market-index-research` before Next.js build.

## Non-goals
No admin UI route, admin authorization integration, external provider calls, licensed index ingestion, permanent database writes, production/main changes, AI POWER, notifications, scheduler or trading changes.

## Next gate
Wait for the new Preview build to complete and inspect its actual test logs. Before exposing this in an admin UI, review the existing route's authentication, access controls and server/client data boundary. Synthetic/manual-review candidates are NOT licensed or verified market data.
