# 09:05 diagnostics — collection architecture decision (draft, 2026-10-26)

## Current verified state
- Offline classification and aggregation CI #19 passed; this is **not live data evidence**.
- Development-only private table: `morning_quote_research.quote_diagnostics` on `signal-x-dev`, zero rows at last read.
- The existing morning runner is connected to production Postgres. No diagnostic writer is connected.
- Rights to persist Yahoo chart-derived metadata for this use are **not verified**.

## Decision: do not activate live collection yet
Reject direct production-runner → development-DB writes for now. That approach would add a cross-environment credential to production and risks accidental coupling between environments. Do not put dev DB credentials in production or expose any privileged key to browsers.

### Candidate A — recommended for first real trial, after licensing
A **separate development-only research runner** using an explicitly licensed intraday data feed and a development-only database connection. No imports from production trading/notification modules; no writes to production tables. It should run only after operator approval and with a bounded sample and retention policy. This requires verifying that the provider's terms cover automated intraday collection, derived metadata retention, and commercial research.

### Candidate B — later, only if required
An isolated production-side diagnostic sink with its own private table and restricted server-side credentials. This needs separate approval, migration review, privilege testing, retention controls, and a nonblocking design. Never silently write to development from the production runner.

## Minimal record
`research_run_date`, `stage`, `reason`, `http_status_class`, `timestamp_count`, `has_0900`, `has_0905`, `classifier_version`, `recorded_at`. No raw provider response, symbol, user ID, OHLCV, access token, or exception text.

## Acceptance checklist
1. Provider licensing confirmed in writing for intended source, use and retention.
2. Environment and secrets reviewed: no production→dev DB credential or browser-exposed key.
3. Actual anon/authenticated negative access tests pass; privileged writer scoped and audited.
4. Retention period, deletion procedure and failure behavior approved.
5. Dry run with synthetic fixtures passes; real-data trial explicitly approved.
6. Every saved row is labeled as metadata only, never price-validated; no AI scoring, trade signals, ranking, cron or notifications changed.
7. Observability counts attempted, saved, rejected, and failures without exposing symbols or prices.

## Open decisions for owner
- Which licensed provider and plan permits five-minute timestamps and metadata retention?
- Which architecture (A or B), retention period, and sample size are approved?

Until those decisions are settled, keep collection disabled and report **0 actual diagnostic records** as the last verified state.
