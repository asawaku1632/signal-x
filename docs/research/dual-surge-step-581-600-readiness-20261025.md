# STEP 581–600 | Dual Surge release-readiness gates (research only)

Status: **NOT APPROVED FOR PRODUCTION**. This checklist documents verification requirements; it is not evidence that a provider license or data feed exists.

## Required gates

| Steps | Gate | Evidence required | Failure behavior |
| --- | --- | --- | --- |
| 581–584 | Source identity and permission | Provider, product, contract/license scope, allowed storage, derived display, retention and redistribution recorded with dated approval | Block ingestion and derived production use |
| 585–588 | Freshness and calendar | Timestamp, timezone, exchange session date, holidays, missing/late records and stale threshold verified | Mark unavailable, never substitute fabricated prices |
| 589–592 | Provenance and replay | Raw-data hash, immutable source/version, calculation version, as-of cutoff, reproducible outcome, pending/matured separation | Mark unverified, no success counts |
| 593–596 | Isolation and authorization | Development DB identity, write target, owner-only access, RLS, secrets separation, absence of production dependencies reviewed | Deny access and writes |
| 597–600 | Test and release decision | Negative tests, CI logs, reviewer sign-off, explicit decision and outstanding risks recorded | Remain research-only |

## Evidence register (initial state, 2026-10-25)

- **Provider permission:** unverified. No automated licensed feed is authorized by this document.
- **Live quote freshness:** unavailable until a permitted provider is configured and validated.
- **Offline deterministic replay:** implementation exists in `app/lib/research/dualSurgeRawReplay.mjs`; independently supplied, licensed OHLCV has not been established.
- **Research admin access:** server-side owner guard exists at `app/admin/dual-surge-shadow/page.tsx`; production authorization is not implied.
- **End-to-end environment isolation:** requires a separate credential/configuration audit; source-level guards alone do not prove it.
- **CI:** retain the exact commit SHA and run URL for each completed gate; previous screenshots do not certify this checklist.

## Non-negotiable boundaries

Do not merge to `main`, deploy production, write to production DB, change notifications or Cron, or connect live trading. A green build is **not** provider approval, accuracy validation, or authorization to publish market data.

## Review record template

For each gate, record: step range, reviewer, timestamp, commit SHA, evidence URL, expected behavior, observed behavior, and verdict (`PASS`, `FAIL`, `BLOCKED`). `BLOCKED` must not count as `PASS`.
