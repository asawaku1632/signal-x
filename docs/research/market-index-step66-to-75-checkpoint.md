# STEP 66–75 — Eligibility test wiring and release-gate checkpoint

This checkpoint records ten review milestones. A milestone is not a claim of ten independently deployed features.

- **66 — Previous Preview:** Research checkpoint commit e733729 was observed READY on the correct Vercel Preview.
- **67 — Test command:** Added `npm run test:market-index-research` to package.json (f6a9445).
- **68 — CI alignment:** Updated the dedicated research-only GitHub Actions workflow to use that npm command (1fdc6ad).
- **69 — Trigger coverage:** Added package.json to the workflow push path filters, alongside the test source, eligibility source and workflow file.
- **70 — Missing field cases:** Added null field rejection assertions (742c3a3).
- **71 — Timestamp cases:** Added UTC timestamp acceptance and timezone-free timestamp rejection assertions (742c3a3).
- **72 — Existing hardening:** Confirmed previous malformed top-level candidate protection remains in the research source.
- **73 — Deployment check:** At inspection, commit 742c3a3 was QUEUED and 1fdc6ad was BUILDING. No READY claim for those commits.
- **74 — CI check:** Existing shadow research checks run 40097181752 was in progress when inspected. The dedicated eligibility test workflow's successful execution was not established; the available commit-workflow lookup is incomplete for push-triggered workflows.
- **75 — Safety checkpoint:** All changes are on branch research/market-index-shadow-20261021. No real licensed Nikkei/TOPIX observations, trusted exchange-session calendar, finalization DB schema, concurrent save verification, production deploy, scheduler, AI POWER, notification or order integration. The test suite is authored and wired but must actually run green before being called verified.

Next: confirm dedicated GitHub Actions eligibility run and latest Preview build, fix errors if any, and only then consider dev-only DB finalization experiments subject to licensing and explicit persistent-write approval.
