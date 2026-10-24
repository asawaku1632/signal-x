# Dual Surge recovery checkpoint (2026-10-25)

## Confirmed
- Previously blocked integrity test file was successfully committed in three small GitHub writes.
- Ten new aggregate/denominator test cases are defined in `tests/research/dualSurgeIntegrity.test.mjs`.
- Isolated research GitHub Actions workflow now includes that test file.
- A manually reconstructed local copy of the integrity module and test file was executed under Node.js: **10 tests passed, 0 failed**. This is a *local reconstructed copy*, not a GitHub checkout or GitHub Actions run.
- The research suite now declares **104 test cases** based on earlier recorded 94 plus these 10. Full-suite CI status is still unverified.

## Unresolved
- The 24 historical event identities and underlying authorized provider rows are not available for actual replay.
- Full GitHub Actions run conclusion is not verified.
- The local reconstructed test run does not certify exact repository HEAD, all tests, or production readiness.
- Production remains out of scope. No main merge, automated provider requests, cron, Supabase writes or notification changes.

## Next checks
1. Verify the actual workflow job and all 104 test results.
2. Address any failing tests with isolated, minimal fixes.
3. Obtain permitted immutable event-level inputs and reconcile 24 identities and maturity counts.
4. Do not report predictive accuracy or executable profit from aggregate diagnostics.
