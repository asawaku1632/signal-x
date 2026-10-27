# STEP 241–260 — Manual-review evidence bundle preflight

These are twenty documented research checkpoints, not twenty independently deployed features.

| STEP | Checkpoint | Result |
|---|---|---|
| 241 | Inspect STEP 240 Vercel status | 44164d1 queued at initial inspection |
| 242 | Inspect STEP 240 existing GitHub shadow CI | Run 40100672947 success |
| 243 | Find most recent READY Preview | 3a086da READY |
| 244 | Inspect Preview build logs | Retrieved |
| 245 | Confirm test-first build gate executed | Confirmed |
| 246 | Confirm evidence review tests executed | Successful markers visible |
| 247 | Confirm calendar comparison tests executed | Successful markers visible |
| 248 | Confirm build completed | Build Completed [39s] |
| 249 | Identify gap: evidence checks not combined | Research-only composition added |
| 250 | Validate claimed rights coverage first | Implemented |
| 251 | Reject revoked rights | Implemented + test |
| 252 | Reject unclaimed use | Implemented + test |
| 253 | Reject out-of-range dates | Implemented + test |
| 254 | Require calendar claim consistency | Implemented + test |
| 255 | Require claimed open session | Implemented + test |
| 256 | Require request/calendar index match | Implemented |
| 257 | Require request/calendar date match | Implemented + test |
| 258 | Reject malformed bundle | Implemented + test |
| 259 | Ensure output says manual review, not authorization | `readyForManualReview` only |
| 260 | Save checkpoint and verification limitations | This document |

Code commits: 5518887 (bundle preflight), 7485c68 (tests).

IMPORTANT: The synthetic fixtures and asserted evidence are NOT real rights evidence or an authoritative exchange calendar. Even `readyForManualReview: true` does not grant rights, verify sessions, authorize persistence, or connect any provider. Latest new tests are not confirmed passing at checkpoint. Dedicated GitHub eligibility workflow status remains separately unverified. No production/main, persistent DB, scheduler, AI POWER, notifications or order changes.
