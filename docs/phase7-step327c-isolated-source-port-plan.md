# SIGNALX Phase7 STEP327C: Isolated source port plan (NOT deployed)

**Status (STEP327E):** Nine audited sources were committed to the isolated branch in STEP327D. The three result-followup allowlist files have since been adjusted for previously saved code 3762. The staging guard is re-pinned. No GitHub Actions scheduled SAVE, PROD deployment, or DEV result write was enabled. PR #130 remains draft.

Branch: `phase7-step327b-dev-autotrack-staging` (never push this source set directly to `main`). Base: `main`.

## Pinned candidate source content

| Operation | Path | Required Git blob SHA-1 |
|---|---|---|
| CREATE | `app/lib/technicalObservation/bollingerShadowDevSecurity.ts` | `3ffc95d53eb3be7ba27f420981b1d1bf979ae776` |
| UPDATE | `scripts/run-bollinger-shadow-dev.mjs` | `e9dda9dc25f9b87b3e92e639294c17fb659e717d` |
| UPDATE | `app/lib/technicalObservation/bollingerShadowAutomation.ts` | `e177ab5b84bdda51956ae5400aa1615a9b8826bf` |
| CREATE | `app/lib/technicalObservation/bollingerShadowQueries.ts` | `d3ce6ea521228ddf02d7dfd6c64d9a6a7a74e9aa` |
| CREATE | `app/lib/technicalObservation/bollingerShadowLeaseFence.ts` | `28b43a2c1ed10959f769e7a9d2ec5ecf235d40c3` |
| UPDATE | `app/lib/technicalObservation/bollingerObservationRunner.ts` | `d440df8fc37816f4357fa70f44c97024cbb3288c` |
| UPDATE | `app/lib/technicalObservation/bollingerObservationPersistence.ts` | `0c899b98c0610e8c6bdb04c4c6db58083a12e732` |
| UPDATE | `app/lib/technicalObservation/bollingerObservationResultRunner.ts` | `39f19d2ce2b7862a06669a9962d137487ea8d315` |
| UPDATE | `app/lib/technicalObservation/bollingerObservationResultPersistence.ts` | `4fb74ffe787f040b9dade625747e159fbce5dd7c` |

## Before enabling automated results SAVE
1. Verify every candidate against historical ZIP hash, local Windows worktree and expected GitHub `main` blob.
2. Review changes as one atomic isolated-branch candidate; never replace previously added lease-fence/TLS/capability constraints with older GitHub code.
3. Require tests of real app and offline SQL policy; avoid credentials in any source and test logs.
4. Guard staged workflow by `SIGNALX_PHASE7_DEV_AUTOTRACK_ENABLED`, off by default; even if enabled, the current workflow runs only a source-preflight, not SAVE.
5. Do **not** merge the draft PR until proper DEV-only unattended auth provision, E2E, backfill, retry behavior and operations review are complete.

Target timetable: 2026-10-19 H3, 2026-10-21 H5 at/after 15:40 JST. Schedule proposal is weekdays 16:10 JST, but scheduler execution time and provider freshness are not guaranteed.

**This is a PR-side change plan only. PROD, DEV SQL, existing Cron, secrets and source files in main are not modified.**
