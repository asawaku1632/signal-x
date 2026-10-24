# Dual Surge validation follow-up — 2026-10-24

Branch: `fix/dual-surge-dev-db-isolation-20261023`.

## Verified now
- The existing local evaluation test copy was executed using Node.js: **13/13 pass**. This is not an end-to-end or CI run.
- The GitHub combined commit status for `7a80f5c011039dc6d6664bcc64fefbe52599735e` showed three Vercel statuses as `success` (signal-x, signal-x-ppjg, signalx-notification-runner). These statuses do not certify the research test suite.
- GitHub connector's workflow-run lookup only exposes PR-associated runs; it did not establish a run/conclusion for the push-only research workflow.

## Additional quality fix
- Added `validIsoSessionDate` to reject impossible dates such as 2026-02-30 that JavaScript Date.parse may normalize.
- Applied the guard to strict provider normalization and the read-only provider preflight.
- Added six synthetic calendar test definitions and registered the new file in CI.
- **84 declared research tests** in nine files (previous 78 plus 6); only the separate 13 local evaluation tests have a verified run in this follow-up.

## Still blocked
- Cannot claim 84/84 CI passing without the actual workflow run result.
- No immutable, licensed event-level OHLCV source data for the historical 24-event baseline was supplied in this session; no real-data reconciliation.
- No production merge, automated provider collection, Supabase writes, notifications, or live trading signal changes.

## Next acceptance
Obtain the research workflow run URL/conclusion, resolve any failures, and compare all 24 event identities using authorized immutable historical rows before drawing statistical conclusions.
