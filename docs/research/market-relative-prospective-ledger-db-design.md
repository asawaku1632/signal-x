# Prospective snapshot ledger — database design (research only)

Status: **design, not applied**. No production database changes, ingestion, cron, or notifications.

## Proposed columns

`signal_id text primary key`, `code text not null`, `ai_power numeric not null`, `price numeric not null`, `price_observed_at timestamptz not null`, `signal_observed_at timestamptz not null`, `captured_at timestamptz not null`, `source text not null`, `version text not null`, `created_at timestamptz not null default now()`. Require AI POWER in [0,100], price >0, four-digit code, nonblank source/version, price time <= signal time <= captured time, age <=20min, capture delay <=60s. Database time and trusted server time must be reconciled; do not trust browser-supplied timestamps.

## Append-only contract

- Primary key `signal_id`; duplicate identical input is idempotent, conflicting duplicate must fail.
- No UPDATE/DELETE/TRUNCATE for application roles. A BEFORE UPDATE OR DELETE row trigger plus BEFORE TRUNCATE statement trigger can reject modifications; restricted table owner/privileged admin can still alter schema or disable triggers. This is tamper resistance, **not cryptographic proof**.
- No `ON CONFLICT DO UPDATE`; avoid `REPLACE` semantics. Concurrent conflicting inserts must be distinguished from identical retries by comparing the stored record after unique conflict.
- Enable RLS, revoke all anon/authenticated access, grant only minimum insert/select to dedicated trusted server role after security review; service role credentials never in browser.
- Store outcomes in a **separate** table keyed by `signal_id`, horizon and benchmark, preserving original snapshot rows.
- Never infer 09:05 fills from daily OHLC candles or treat imported historical records as real-time evidence.

## Pre-activation gates

1. Independent source and algorithm-version audit, market data rights and provider freshness.
2. Review migration in isolated dev environment, verify permissions, RLS, duplicate/concurrent writes, UPDATE/DELETE/TRUNCATE denial, and rollback plan.
3. Verify trusted clock and provider timestamp provenance.
4. Explicit approval before enabling automatic capture or production deployment.

See Supabase documentation: https://supabase.com/docs/guides/database/postgres/triggers
