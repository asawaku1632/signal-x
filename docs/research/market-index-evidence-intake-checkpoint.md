# Market index evidence review — research checkpoint after STEP 200

## Implemented
- `app/lib/research/market-index-evidence-review.ts`: pure, non-authorizing intake contracts for provider-rights drafts and exchange-session evidence drafts.
- `app/lib/research/market-index-evidence-review.test.ts`: synthetic regression cases for scope, provenance, validity, revocation, calendar evidence and invalid inputs.
- `package.json` `test:market-index-research`: includes both existing finalization-eligibility tests and new evidence-review tests; `npm run build` invokes this script before `next build`.

## Crucial boundary
`reviewable: true` means that required *fields have a plausible shape*. It is NOT a rights grant, permission to store or display data, a valid exchange-session determination, or proof that the named verifier performed verification. Synthetic test fixtures must never be treated as provider evidence.

No network/provider adapter, exchange holiday feed, database writes, scheduler, production routing, AI POWER, notification or trading changes were made.

## Next checks
1. Verify new Preview deployment is READY and its build log shows both test files executed and the build completed.
2. Inspect whether the dedicated eligibility GitHub Actions workflow is registered; the Vercel test-first build is the currently confirmed execution path.
3. Obtain actual provider licensing and trusted calendar evidence before any integration.
4. Ask for explicit approval before permanent dev schema changes or persistent dev writes.

Research branch only: `research/market-index-shadow-20261021`.
