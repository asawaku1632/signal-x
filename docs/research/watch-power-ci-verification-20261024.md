# WATCH holdout research CI verification — 2026-10-24

GitHub Actions run 40056068859, workflow `WATCH holdout research tests`, job `research-tests` (job ID 120759220913): completed successfully. `npm ci --ignore-scripts` and `node --test scripts/test-watch-power-holdout.cjs` both succeeded. Logs show **8 tests, 8 pass, 0 fail**, approximately 237ms test runtime. Includes conflicting duplicate quarantine regression.

Scope: pure frozen holdout evaluator unit/regression tests. Does **not** prove adapter integration, Supabase permissions, production scheduling, future 5-session outcome maturity, executable trade results, or statistical predictive accuracy. Research branch and draft PR only; no production deployment or DB writes.

Run: https://github.com/asawaku1632/signal-x/actions/runs/40056068859
