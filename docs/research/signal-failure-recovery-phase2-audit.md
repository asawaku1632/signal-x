# Phase 2 — Existing-system audit (2026-10-21)

Inspected default branch source files:
- app/api/cron/bb-observation/route.ts: reads scan snapshot, validates freshness/coverage and writes BB signal events; own lock and logging.
- app/api/cron/swing-exit-audit/route.ts: captures swing exit signals, updates outcomes, optional isolated post-sale outcomes; cron-auth gated.
- app/api/cron/morning-market-forward/route.ts: separate forward capture with cron auth.
- app/lib/cronAuth.ts: requires CRON_SECRET or NOTIFICATION_RUNNER_SECRET.
- vercel.json: scheduled BB observation/evaluation, swing audits and other research jobs.

## Decision
Reuse patterns, NOT existing research tables blindly. No modification to existing cron endpoints. Build a separate immutable signal-event capture adapter and adverse-event/outcome observer only after checking source schema, signal timestamps, snapshot provenance and market calendar.

## Outstanding source audit
1. Locate actual buy-condition trigger and saved event table; confirm event time and reference price are immutable.
2. Check quote source freshness, market sessions and adjustments.
3. Confirm duplicate protections, ownership/RLS and database migrations.
4. Verify scheduler capacity and idempotency before adding cron.
5. Build deterministic fixtures for 3762 scenario without inserting real observations.

## Current status
Repository inspection completed; no new scheduler, database tables, API endpoints or UI are deployed. Data collection for these two studies has NOT started.
