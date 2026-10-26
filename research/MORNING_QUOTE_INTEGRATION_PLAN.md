# 09:05 quote metadata integration plan (research branch only)

This plan does **not** modify the running morning capture, cron, database, AI score, or notifications.

## Existing state
- Pure classifier: `app/lib/research/morningQuoteMetadata.ts`
- Eight offline test cases: `tests/morningQuoteMetadata.test.mjs`
- Branch-only workflow: `.github/workflows/morning-quote-metadata-research.yml`
- Production 2026-10-21 through 2026-10-26: 20/20 morning `price0905` missing; 10/20 `MISSING_CANDLES`, 10/20 reason not recorded.
- Independent closing research has 20/20 `closePrice` fields populated, 16/20 completed outcomes. Field presence does not verify price accuracy.

## Proposed integration, not applied
1. Make the existing morning fetch return `{bars, diagnostic}` rather than bars alone, with diagnostic restricted to reason, HTTP status class, array-presence flags, and 09:00/09:05 presence. Never include raw OHLCV or personal data in diagnostic.
2. Preserve existing fail-closed `decideAtNineOhFive` behavior and one-claim-per-day limit; no retries, retroactive 09:05 prices, or later-day lookahead.
3. If and only if licensed provider use is authorized, attach metadata to the existing admin-only research observation. No new public API or table. Confirm size and access controls.
4. Keep the error reason separate from `quoteStatus`, and distinguish absent timestamp array from absent 09:05 bar.
5. Test response status, empty payload, provider error, missing arrays, missing bars, malformed timestamps, and 09:05 OPEN availability. Run TypeScript typecheck and offline tests before any deployment review.
6. Audit data-provider rights and independent as-of validity before enabling live collection.

## Important limit
Offline tests and historical database rows cannot establish what the live provider returned at 09:08. Without authorized response metadata captured at the time, the precise upstream root cause remains unverified.
