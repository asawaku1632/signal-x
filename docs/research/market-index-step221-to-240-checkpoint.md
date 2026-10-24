# STEP 221–240 — Calendar alias protection and test verification

Twenty research checkpoints; not twenty independent features.

| STEP | Check | Outcome |
|---|---|---|
| 221 | Inspect previous STEP220 Preview | 3a086da queued at initial check |
| 222 | Inspect STEP220 GitHub shadow CI | Run 40100530442 in progress at initial check |
| 223 | Find last READY research Preview | 71aa82d READY |
| 224 | Inspect READY build events | Retrieved |
| 225 | Confirm both test files invoked | Observed exact Node test command for eligibility + evidence-review |
| 226 | Confirm evidence intake tests executed | Nine successful markers visible |
| 227 | Confirm Next.js build completed | Build Completed in /vercel/output [53s] |
| 228 | Review calendar source distinction | Raw source ID comparison was case/whitespace-sensitive |
| 229 | Normalize source ID whitespace | trim() implemented |
| 230 | Normalize source ID ASCII case | toLowerCase() implemented |
| 231 | Preserve source ID strings in original evidence | No mutation |
| 232 | Add uppercase same-source regression | Added |
| 233 | Add whitespace same-source regression | Added |
| 234 | Add tab/newline mixed-case regression | Added |
| 235 | Add invalid calendar provenance regression | Added |
| 236 | Add invalid open/closed claim regression | Added |
| 237 | Add rights validity start-date boundary test | Added |
| 238 | Add rights validity end-date boundary test | Added |
| 239 | Add adjacent outside-validity dates regression | Added |
| 240 | Record checkpoint and pending latest Preview | New code tests unverified at checkpoint |

Code commits: 390c834 (source ID normalization), a3da3f5 (regression tests).

Safety limits: Source IDs are caller claims; differing normalized strings do not prove independent or authoritative exchange calendars. A consistent claim does not establish real trading-day truth. No licensed provider rights have been verified. Dedicated eligibility GitHub workflow is not independently confirmed. No production/main changes, real provider calls, DB writes, AI POWER, notifications, scheduler or order changes.
