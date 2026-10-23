# Actual scan path and Yahoo intraday exposure — 2026-10-23

Read-only code trace from `main`:

`app/scan-mobile/page.tsx` -> `GET /api/scan?limit=1200&top=100` -> `app/api/scan/route.ts` -> `app/lib/scanSnapshot.ts` -> `app/lib/learning/scanEngine.ts` -> `app/lib/learning/stockAnalyzer.ts` -> `fetchYahooChart(code)`.

- The live-facing scan endpoint is `/api/scan`, not `/api/cron/scan` (the latter has hardcoded synthetic placeholder rows). The production deployment routing and traffic were not checked.
- `scanEngine` selects unique `ACTIVE_STOCKS`, with max limit 1200 and concurrency 20; it calls `analyzeStock` and `runAiPipeline`. Actual current universe size was not independently measured.
- `stockAnalyzer` requests Yahoo Finance chart `range=1d&interval=5m` (up to 60 bars) and `range=3mo&interval=1d` (up to 90 bars), choosing 5m if available and daily fallback otherwise. The code labels source as `intraday` or `daily_fallback`. This is technical availability only, NOT approved data usage.
- `scanSnapshot` stores scan payload and can refresh during trading days; existing data cannot automatically be repurposed for a new study absent permission.
- No new Yahoo quote requests were performed in this investigation.

## Official licensing warning
Yahoo Finance help says **do not redistribute** Yahoo Finance information. Yahoo! Japan support prohibits automated extraction and commercial reuse of its published financial information. The precise endpoint `query1.finance.yahoo.com` and SIGNALX's specific usage need a direct licensing review; do not assert that the Japanese and US terms are identical.

References:
- https://help.yahoo.com/kb/SLN2352.html
- https://support.yahoo-net.jp/SccFinance/s/article/H000011276
- https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html

## Immediate decision
Do not connect existing Yahoo 5m data to afternoon research storage or public outputs. Do not enable cron, change production scan, or purchase data. Request written clarification of use rights or obtain a licensed commercial feed. Keep all research gates BLOCKED until documented approval.

## Separate production-risk follow-up
Audit `/api/cron/scan` reachability, scheduler configuration and whether any consumer treats its synthetic data as real. Do not delete or modify it without tracing dependencies.
