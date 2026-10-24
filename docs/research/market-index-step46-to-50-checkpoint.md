# STEP 46–50 research checkpoint

STEP 46: Added TypeScript node:test unit-test source for the pure eligibility contract. Commit 65482b6. Tests are authored, not executed.

STEP 47: Synthetic happy-path cases for Nikkei and TOPIX included. A synthetic rightsEvidenceId does not establish real licensing.

STEP 48: Fail-closed cases include unsupported index, missing rights, absent session calendar verdict, invalid date, unavailable status, zero/nonfinite value, invalid timestamp, and missing source identity.

STEP 49: Verified previous checkpoint commit 5225ba4 was READY on the correct Vercel research Preview. Deployment of test commit 65482b6 was BUILDING at the time of inspection; do not claim this new build passed. Runtime unit-test execution not verified.

STEP 50: Review checkpoint. Tests are not integrated into the npm test script and are not run by Vercel merely because the source file exists. Next: use a supported TS test runner, run tests and TypeScript build in an isolated CI workflow, inspect Preview build, and fix any failures. No persistent dev schema, provider licensing, calendar integration, actual parallel DB writers, production deployment, scheduled capture, AI POWER, notification or trading changes.
