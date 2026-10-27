# STEP27 — Evidence-to-use register (2026-10-27 JST)

## Purpose
Separate observed research evidence from operational eligibility. **A PASS on a software test does not authorize market data acquisition or production integration.**

| ID | Subject | Evidence / scope | Status | Permitted use | Blocked use |
| --- | --- | --- | --- | --- | --- |
| S27-01 | Offline freshness classifier | Three fixed mock cases (fresh, stale, missing close), reported as passed; no market feed | TESTED_MOCK_ONLY | Regression checks for classifier logic | Claims of real-time price freshness |
| S27-02 | Preview transaction/retry/cleanup | Admin-reported first lock, concurrent block, commit, retry, duplicate skip, cleanup success | TESTED_ISOLATED | Dev-only regression evidence | General concurrency guarantees |
| S27-03 | Sequential manual unavailable save | 2026-10-27 API: first persistedRows=1/alreadySaved=false; second persistedRows=0/alreadySaved=true | VERIFIED_API | Research status-record deduplication evidence | Market price validity |
| S27-04 | DB corroboration | Admin-run SELECT returned JST 2026-10-27 nikkei count=1, reason=PROVIDER_APPROVAL_REQUIRED | VERIFIED_DB_COUNT | Corroborate S27-03 | Unobserved dates, indexes, simultaneous requests |
| S27-05 | Older dev history | Admin-run SELECT: 10/23 nikkei=1, topix=1; 10/22 nikkei=1 | VERIFIED_DB_COUNT | Historical snapshot of those groups | Continuous integrity guarantee |
| S27-06 | Nikkei/TOPIX licensed data | No approved contract/rights evidence | BLOCKED_UNVERIFIED | Document licensing questions | Fetch, persist, redistribute, commercialize |
| S27-07 | Official market calendar | No authoritative integrated evidence | BLOCKED_UNVERIFIED | Define acceptance criteria | Live session/calendar assertions |
| S27-08 | Real feed price/freshness | No licensed real feed connected or validated | BLOCKED_UNVERIFIED | Plan validation protocol | Live market claims, production signals |
| S27-09 | Scheduled collection | Not configured | DISABLED | Document prospective design | Enable cron or auto-capture |
| S27-10 | Production AI/notifications/orders | No approved integration | DISABLED | Document future gated proposal | Enable or alter production decisions |

## Evidence promotion policy
1. **Observed**: retain dated raw output, environment, source, scope, and limitations.
2. **Verified**: independently corroborate with appropriate DB read-only query or reproducible test. Keep proof link and date.
3. **Eligible for research reuse**: document which *software quality* insight may be reused, without importing unlicensed market values.
4. **Eligible for production**: separate approval requires licensed data rights, official calendar, independent quality checks, safe failure behavior, owner authorization, and tested rollback. **None of S27-01 to S27-10 is approved to enable production index ingestion.**

## Safe reuse now
- Reuse the manual-save idempotency acceptance criterion: same JST date + same index + same reason should not create a second status row.
- Reuse offline freshness test cases and the fail-closed unavailable state as regression criteria.
- Reuse audit evidence and distinguish simulated test outputs from actual feed observations.

## Next research checks (no production mutation)
- Design a read-only daily duplicate-count check for the development status records; retain query and timestamp.
- Design a simultaneous-request test for the **manual-save path**, separately from the existing isolated lock test; run only with explicit approval.
- Specify official provider licensing and calendar evidence needed before any live data validation.

## Traceability
- Primary audit: [2026-10-27 manual dedup audit](./market-index-step27-manual-dedup-audit-2026-10-27.md)
- UI addition commit: `4e24da0173999c2447f167b984b4701f4dc31a9a`
- Audit commit: `4649e6a4fd1882bd499034b7a7a7c5163081ba19`
- Environment: research Preview branch `research/market-index-shadow-20261021`; development Supabase ref `jdtqwryiyxeuoraecorw`.
- These are user-provided outputs, not an independent inspection of Supabase database rows by the document author.
