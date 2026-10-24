# Dual Surge — Steps 81–100 (2026-10-24)

**Scope:** research branch `fix/dual-surge-dev-db-isolation-20261023`. This milestone records specific source changes and verification limits, not an assertion of full historical replay.

| Step | Work item | Result |
|---|---|---|
| 81 | Inspect previous aggregate baseline | Reviewed |
| 82 | Identify unsupported return buckets | Found unverified five-session breakdown |
| 83 | Remove unsupported buckets | Frozen baseline updated |
| 84 | Preserve supported aggregate counts | 24 events, 15 matured, 11 positive, 4 negative, 9 pending remain reference only |
| 85 | Add provenance warning | Manifest states bucket removal is pending event-level evidence |
| 86 | Define event identity | code + cohort + first signal date |
| 87 | Validate stock code | Four-digit strict code |
| 88 | Validate cohort | PRE_SURGE_V1 or SURGE_START_V1 only |
| 89 | Validate real calendar date | Strict session date guard |
| 90 | Reject duplicate event identities | Fail closed |
| 91 | Compare reference and candidate IDs | Missing/unexpected lists |
| 92 | Keep count differences visible | Separate reference/candidate counts |
| 93 | Require source snapshot identifier | Provenance gate |
| 94 | Require verified data rights | Explicit licenseVerified boolean |
| 95 | Require confirmed CI status | Explicit ciVerified boolean |
| 96 | Keep production gate closed | productionApproved:false |
| 97 | Add event-identity regression tests | 10 tests defined |
| 98 | Add evidence-gate regression tests | Included in same 10 tests |
| 99 | Register CI test file | Workflow updated |
| 100 | Record acceptance criteria | This document |

## Changed files
- `docs/research/dual-surge-frozen-baseline-20261024.json`
- `app/lib/research/dualSurgeEvidence.mjs`
- `tests/research/dualSurgeEvidence.test.mjs`
- `.github/workflows/dual-surge-research-tests.yml`
- `docs/research/dual-surge-steps81-100-20261024.md`

**94 tests are defined** across ten research test files (previous 84 plus 10). Their full run status is **not verified**. A previous local subset of 13 evaluation tests passed; that is not evidence that all 94 pass.

## Data blockers
- No authorized, immutable 24-event OHLCV snapshot or per-event reference list was supplied.
- No confirmed provider-license basis for automated research was supplied.
- GitHub combined commit status showing Vercel successes does not imply research Actions CI passed.
- Event identity equivalence is necessary but insufficient: price adjustment, missing sessions, costs, fills and selection bias still require validation.
- Synthetic passing evidence gates are tests of control flow, not historical verification.

## Next acceptance
1. Obtain GitHub Actions run URL and verified conclusion for research suite; fix failures.
2. Obtain authorized immutable provider snapshots, licensing metadata, and reference 24-event list.
3. Reconcile each event's ticker/cohort/date and 1/3/5/10-session outcomes, including exclusions and corporate actions.
4. Verify price proxy semantics and cost sensitivity before interpreting performance.
5. Keep production and automated data access disabled until separate explicit authorization.

No production deployment, database write, cron or notification was performed.
