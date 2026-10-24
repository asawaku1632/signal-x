# Admin market index research view — security review

Research branch only: `research/market-index-shadow-20261021`.

## Existing access boundary (source inspection)
- `app/api/admin/market-index-research/route.ts` GET calls `getAdminSession()` and returns 403 if `!isAdmin`.
- GET optionally reads a *specific dev Supabase project* with identity checks and a read-only transaction; no production fallback. This is a pre-existing behavior, not newly enabled.
- Existing POST has same-origin and Preview-admin restrictions but is a state-changing route for synthetic unavailable-status records. Do not reuse it for the new dashboard without separate review and approval.
- `app/admin/market-index-research/page.tsx` is a client component that fetches the admin GET endpoint; it also contains a pre-existing dev commit/retry test button that can write and clean up dev test rows. No new UI was connected during this review.
- New `buildResearchDashboardModel` remains a pure, server-agnostic function. No route or live data source is wired to it.

## Safety decision
Do not import synthetic evidence fixtures into a live page and label them as real observations. Do not expose raw rights evidence or calendar provenance in client props. Any future dashboard endpoint must enforce `getAdminSession` server-side, be read-only, fail closed, and explicitly identify whether records are synthetic, absent or externally verified. Keep status `research_only` and warnings visible. Avoid claiming provider rights or trading-day verification.

## Remaining tasks
1. Confirm latest Preview executes new dashboard model tests and finishes READY.
2. Define read-only research dashboard endpoint contract with explicit no-data state.
3. Verify server-side admin authorization and isolation from production before any UI integration.
4. Obtain independently authenticated provider license and authoritative calendar evidence before finalization.

No main/production changes, permanent dev DB writes, provider calls, AI POWER, notifications, scheduler or trading changes.
