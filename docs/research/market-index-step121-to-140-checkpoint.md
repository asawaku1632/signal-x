# STEP 121–140 — Research-only test execution gate

These are 20 verification and safety checkpoints, not 20 independently delivered features.

| STEP | Verification or change | Evidence / status |
|---|---|---|
| 121 | Verify STEP 120 Preview | cc4ad60 READY |
| 122 | Verify existing shadow research workflow | Run 40097993606 success |
| 123 | Identify test execution visibility gap | Dedicated eligibility workflow success unverified |
| 124 | Review research-only package scripts | npm test:market-index-research present |
| 125 | Gate Next.js build behind eligibility test command | package.json commit 82cbfa3 |
| 126 | Preserve original Next.js build after test | Script is npm run test:market-index-research && next build |
| 127 | Preserve dev/start/lint commands | Unchanged |
| 128 | Preserve research-only branch | No main branch changes |
| 129 | Add explicit placeholder provider rejection regression | commit 916e2b3 |
| 130 | Add whitespace-trimmed placeholder regression | commit 916e2b3 |
| 131 | Add whitespace-only provider ID regression | commit 916e2b3 |
| 132 | Add whitespace-only run ID regression | commit 916e2b3 |
| 133 | Add stable key / deterministic pure function regression | commit 916e2b3 |
| 134 | Check latest Preview build after code change | Latest commit QUEUED at inspection |
| 135 | Check prior Preview build | STEP 120 cc4ad60 READY |
| 136 | Distinguish existing shadow CI from dedicated eligibility suite | Existing workflow success is not proof of eligibility tests |
| 137 | Require build log evidence | A future READY alone proves tests only if Vercel actually uses package.json build command |
| 138 | Preserve licensing guard | licensed-provider-pending remains rejected |
| 139 | Preserve no-write and no-trading scope | No DB writes, live data, scheduler, production, notifications, AI POWER or orders |
| 140 | Final release gate | New Preview and exact test command must be verified before claiming full success |

Important: This checkpoint does not claim the latest build or dedicated eligibility test suite has passed. The code was committed to research/market-index-shadow-20261021. The package.json build change is confined to that branch and will gate Vercel only if Vercel uses that npm build script. If the Vercel project overrides its build command, inspect and adjust the research Preview configuration safely rather than assuming coverage.

Next verification: inspect build logs for explicit `npm run test:market-index-research` output, test counts and result, then Preview READY. If unavailable, investigate GitHub Actions dedicated workflow status or workflow enablement.
