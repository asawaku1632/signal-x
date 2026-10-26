# Morning 09:05 shadow activation gates — 2026-10-26

## Verified

- GitHub Actions **#12 completed/success** on commit `cc9c63b184ed98e001bad8c2420657c8501d4daa`: https://github.com/asawaku1632/signal-x/actions/runs/40326752672 . This is **offline CI only**, not evidence of real 09:05 price availability.
- Development Supabase `signal-x-dev` has private schema `morning_quote_research` and table `quote_diagnostics`, RLS enabled, zero policies, zero records at verification. `anon` and `authenticated` had no schema USAGE, SELECT, or INSERT privileges.
- The safe mapper and offline summarizer are not wired to the morning runner, a DB writer, or an API route.

## Blocks before live shadow collection

1. **Data rights:** verify whether metadata derived from the existing Yahoo five-minute chart response may be retained and used for commercial research. Do not assume permission from successful HTTP responses. Alternatively use a licensed provider with written rights and compatible five-minute intraday timestamps.
2. **Deployment isolation:** production's existing morning runner uses the production DB connection. Connecting it directly to the development-only research table would require a second database credential and a new cross-environment write path. **Do not do this without a reviewed architecture and explicit approval.**
3. **Access control:** the existing DB privilege check is structural, not a live anon/authenticated request test. Verify negative reads/writes from actual unprivileged sessions before enabling any access. Keep the research schema out of exposed Data API schemas.
4. **Capture contract:** add an explicit opt-in shadow caller after existing successful response receipt. It must be nonblocking, fail closed, and never change original quote status, original response parsing, retry count, API request count, ranking, notifications, or trade signals. It must not store raw payload, symbol, OHLCV, or user identifiers.
5. **Data quality:** the classifier reports timestamp presence, not validated price. Require explicit independent OHLC validation and a licensed feed before claiming 09:05 prices are accurate.
6. **Retention:** set bounded retention and an administrator-only deletion process; document operator and audit trail.

## Immediate safe next step

Keep the new mapper and summary disconnected while checking provider terms and the architecture for an authorized shadow collection path. Offline fixtures can be evaluated without further provider calls. The cause of missing 09:05 quotes remains unconfirmed.
