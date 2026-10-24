# Market index shadow: live provider verification checklist

This document is a **manual read-only gate**, not proof that Yahoo Finance works.

## Provider identity
- Nikkei: request `^N225`, verify response `meta.symbol` matches.
- TOPIX: request `998405.T`, verify response `meta.symbol` matches.
- Also cross-check the *numeric value and session date* against an independent TOPIX/Nikkei source; matching a symbol alone is insufficient.
- Confirm Yahoo Chart actually returns timestamped 1-minute bars for both symbols, and whether the response is delayed.
- Reject absent/invalid timestamp or price, stale bars, and out-of-session dates. Do not infer timestamp from request time.
- Record response status, returned symbol, last bar time JST, lag in minutes and rejection reason. Do not log provider credentials.

## Persistence and rollout
- Only use `signal-x-dev` until the provider checks pass.
- The current `marketIndexShadowStore.ts` uses `DATABASE_URL` from `app/lib/postgres.ts`. Verify the deployment points to **dev** before invoking it.
- No Cron, LINE notifications, trading, AI POWER, or `market_learning_logs` modifications.
- Never backfill a past session with the current market price.
- Do not merge this draft PR or apply its SQL migration to production until explicit review.

## Verified
- Dev database table exists, RLS enabled, anon SELECT denied, authenticated INSERT denied.
- Transactional synthetic insert/read and duplicate prevention passed; synthetic rows rolled back.
- GitHub Actions 7-case contract smoke check passed.
- Live Yahoo API response and application-to-dev-database integration remain **unverified**.

## Live read-only probe, 2026-10-21
GitHub Actions ran `scripts/probe-market-index-provider.mjs` (no database credentials, no writes).
- `^N225`: HTTP success, returned `^N225`, latest reported bar `2026-10-21T06:30:00.000Z`, price `64621.23828125`. The capture was about 18:09 JST, so the bar was **stale** under the 20-minute contract. A successful API response is not a valid fresh observation.
- `998405.T`: HTTP 404.
- `^TOPX`: HTTP 404.
- `^TOPIX`: HTTP 404.
- `^TPX`: HTTP 404.
**Conclusion:** Yahoo Finance chart endpoint is not currently verified as a usable TOPIX source. Do not enable TOPIX persistence or a scheduled observation job. Find an alternative provider with explicit timestamp, identity, usage rights, and verified values before proceeding. Do not replace missing TOPIX with Nikkei or with a synthetic price.
