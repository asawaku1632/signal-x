# Existing market-data source inventory (read-only) — 2026-10-23

Inspected **main** branch source files only. No environment variables, API keys, database records, external quote endpoints or paid subscriptions were accessed.

## Confirmed from repository source

1. `app/lib/research/morningMarketForwardRunner.ts`: directly calls `https://query1.finance.yahoo.com/v8/finance/chart/` with `range=10d&interval=1d`, labels its stored snapshots `Yahoo Finance daily chart`, and captures **external market context** only. This is not verified 1-minute equity bars, and Yahoo commercial/reuse rights are **UNKNOWN**.
2. `package.json`: depends on `yahoo-finance2` (^3.14.1), but package presence does not establish which production path uses it or confer redistribution rights.
3. `app/api/cron/scan/route.ts`: contains an explicit placeholder 50-symbol list, synthetic price formula `1000 + Number(code.slice(-2)) * 10`, and placeholder AI POWER. The endpoint's production traffic, invocation, and relationship to the actual 950-stock scan are **NOT VERIFIED**. Do not treat its response as genuine price evidence.
4. `app/lib/research/morningMarketForwardRunner.ts` uses database persistence; existing storage is not proof of historical minute-bar coverage or legal reuse.

## Research decision
**NO APPROVED INTRADAY PROVIDER CONFIRMED.** Keep `commercialRightsApproved=false`, `permission=UNKNOWN`, `intradayAvailable=false` for any proposed afternoon study integration. No quote ingestion, cron, public feature, orders, or alerts.

## Verification checklist (read-only)
- Trace actual production scan entrypoint and its upstream price provider, rather than assume `/api/cron/scan` is live.
- Review Yahoo Finance license and terms for SIGNALX's precise use (public stock scores, paid tier, persistence and redistribution).
- Identify whether current licensed providers offer point-in-time minute bars, full timestamps and historical coverage.
- Document provider approvals before any storage, automation or commercial deployment.

Sources: repository paths above, J-Quants API terms https://jpx-jquants.com/ja/termsofservice?lang=ja and FAQ https://jpx-jquants.com/apidoc.html.
