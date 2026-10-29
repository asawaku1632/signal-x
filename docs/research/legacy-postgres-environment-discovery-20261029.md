# Legacy PostgreSQL environment discovery — 2026-10-29

Read-only metadata check using the currently connected Vercel account. A search for projects matching `signal-x` returned **zero** projects. Unfiltered list returned one unrelated project, `vibe-coding-platform`. Therefore the currently connected Vercel account does **not** establish access to the SIGNALX deployment or its `DATABASE_URL` metadata. No environment variable values were requested or decrypted; no database connection attempted.

Source code `app/lib/postgres.ts` uses `process.env.DATABASE_URL`, but repository source alone cannot classify the destination as production, preview, development, or replica.

**Next required dependency:** connect the correct SIGNALX Vercel account/team or provide a separately authorized, sanitized nonproduction PostgreSQL aggregate export. Confirm target identity and read-only permissions before running `docs/research/legacy-daily-stock-results-readonly-audit-20261029.sql`. Do not fetch or print credentials, query unknown production resources, or imply that missing access means the legacy dataset is empty.

Research branch only. No production changes, no database writes.
