# STEP 161–180 — Preview test verification and research contract safety

Twenty numbered verification checkpoints, not twenty independently shipped features.

| STEP | Work | Result |
|---|---|---|
| 161 | Check STEP 160 Preview | a9385a0 READY, deployment dpl_5rKNUJdUXDqwFzfYHFRAtpbhwpbE |
| 162 | Check existing shadow CI | Run 40098728290 completed success |
| 163 | Inspect actual Preview build logs | Retrieved |
| 164 | Confirm research test-first build script executed | Log contains npm run test:market-index-research && next build |
| 165 | Confirm visible test success markers | Multiple check-mark tests visible |
| 166 | Confirm build completion | Build Completed in /vercel/output [30s] |
| 167 | Clarify logs limit | Retrieved events show partial test output; exact test count not independently verified |
| 168 | Add boxed string candidate regression | Commit b896f7d |
| 169 | Add boxed number candidate regression | Commit b896f7d |
| 170 | Add boxed boolean candidate regression | Commit b896f7d |
| 171 | Add missing ISO T separator rejection regression | Commit b896f7d |
| 172 | Add date-only observedAt rejection regression | Commit b896f7d |
| 173 | Add non-colon timezone offset rejection regression | Commit b896f7d |
| 174 | Add array rights-evidence rejection regression | Commit b896f7d |
| 175 | Add malformed source IDs rejection regressions | Commit b896f7d |
| 176 | Add distinct supported index keys regression | Commit b896f7d |
| 177 | Clarify contract security boundary in source documentation | Commit 8b7e0b2 |
| 178 | Inspect new Preview status | b896f7d BUILDING, 8b7e0b2 QUEUED |
| 179 | Reiterate external provider authorization and trusted calendar gates | Not established by this code or synthetic test |
| 180 | Record checkpoint | Research branch only; no live licensed index ingestion, persistent writes, production deployment, scheduler, AI POWER, notification or order changes |

Important: STEP 160 commit a9385a0 test-first Vercel Preview build succeeded. New STEP 161–180 test additions have NOT been confirmed passing by Preview at checkpoint creation. The pure function's boolean rights/session flags are caller assertions, not independently verified evidence. Dedicated GitHub eligibility workflow pass is still not independently established.

Next: wait for latest Preview, inspect its actual build logs and fix any failing tests. Then prioritize documented provider rights and trusted exchange calendar before any finalization schema or persistent writes.
