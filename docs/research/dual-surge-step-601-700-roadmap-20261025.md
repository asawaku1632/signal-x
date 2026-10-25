# STEP 601–700 | Dual Surge research verification roadmap

**Status: PLANNED / BLOCKED.** This is a scoped work plan, not evidence of implementation or completion. Do not merge, deploy production, change production DB, notifications, Cron or trading.

| Steps | Research-only deliverable | Acceptance evidence |
| --- | --- | --- |
| 601–610 | Baseline CI and test inventory | Commit-specific node tests and build logs |
| 611–620 | Evidence schema validation | Reject missing, expired, malformed and contradictory approvals |
| 621–630 | Provider license and scope checks | Dated written permission for storage, research, display and retention |
| 631–640 | Session/calendar and freshness checks | Holidays, timezone, stale quotes, gaps, duplicates |
| 641–650 | Replay provenance | Immutable hash, source version, as-of, calculation version |
| 651–660 | Outcome integrity | Pending/matured isolation, no lookahead, 1/3/5/10-day denominators |
| 661–670 | Development DB isolation | Verified project IDs, credentials, RLS and write-denial tests |
| 671–680 | Admin authorization | Non-owner rejection, server-only evidence access, no secrets in client |
| 681–690 | Statistical robustness | Embargo, chronological holdout, sensitivity and low-N warnings |
| 691–700 | Final research audit | Evidence register, signed review, CI references, explicit no-go/go for research only |

## Current verified baseline

- The admin page invokes `evaluateReadiness({})`, so all 20 evidence checks are blocked until a verified evidence source is deliberately connected.
- The readiness evaluator always returns `productionApproved:false`. Passing synthetic evidence must never authorize production.
- The UI presents blocked groups; this is **not** live provider or DB attestation.
- GitHub Actions and Next.js build for the latest commit have not yet been verified.

## Mandatory audit record

For each 10-step group capture: commit SHA, run URL, test cases, observed results, evidence origin, reviewer, timestamp, unresolved blockers. Status must be one of PLANNED, IN_PROGRESS, PASS, FAIL, BLOCKED. A missing result is BLOCKED, never PASS.

## Release constraints

No live feed until license permission is independently confirmed. No production writes, deploys, merges, trades, notifications or Cron changes. Only an explicit separate authorization can change this boundary.
