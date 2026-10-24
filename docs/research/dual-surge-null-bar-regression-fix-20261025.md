# Dual Surge null-bar regression fix — 2026-10-25

The existing regression test in `tests/research/dualSurgeEvaluation.test.mjs` requires both `fiveDayOutcome` and `nextOpenReturn` to return `EXCLUDED_MISSING_DATA` for a null intermediate bar.

Review of `nextOpenReturn` showed it still dereferenced `b.adjFactor` without guarding null. Fixed by checking every element in the outcome window before adjustment-factor evaluation.

No new test definition added: the previously committed test already covered this regression. Recorded inventory remains **126 test definitions**.

This is a code-level fix; the full GitHub Actions suite has **not** been verified passing. STEP 140 is not complete without full CI and authorized event-level historical replay. No main merge, production deployment, automated provider collection, Supabase write, cron or notifications.
