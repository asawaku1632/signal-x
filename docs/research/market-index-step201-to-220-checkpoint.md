# STEP 201–220 — Evidence intake and calendar claim comparison

These are 20 numbered research checkpoints, not 20 separate production features. All work remains on `research/market-index-shadow-20261021`.

| STEP | Work | Result |
|---|---|---|
| 201 | Verify last code commit shadow workflow | 825529a existing shadow CI run 40100387920 success |
| 202 | Check Vercel backlog | Latest prior code Preview QUEUED |
| 203 | Review rights evidence draft contract | Present; no provider authentication |
| 204 | Review session evidence draft contract | Present; no real exchange calendar |
| 205 | Review claimed rights coverage | Pure scope/date comparison only |
| 206 | Define comparison result for two session claims | Implemented |
| 207 | Require both calendar claims to pass shape checks | Implemented |
| 208 | Reject mismatched index | Implemented |
| 209 | Reject mismatched session date | Implemented |
| 210 | Require distinct calendar source IDs | Implemented; version/reviewer differences alone insufficient |
| 211 | Reject conflicting open/closed claims | Implemented |
| 212 | Return consistent claim metadata | Implemented, not authorization |
| 213 | Test two matching source-distinct claims | Added |
| 214 | Test same source with different reviewer | Added rejection |
| 215 | Test open/closed conflict | Added rejection |
| 216 | Test date mismatch | Added rejection |
| 217 | Test index mismatch | Added rejection |
| 218 | Test malformed calendar date | Added rejection |
| 219 | Preserve no-provider/no-DB scope | No external connections or persistent writes |
| 220 | Record checkpoint and outstanding verification | Latest Preview/test result unverified at documentation time |

Code commits: 2431711 (initial comparison), 71aa82d (stronger source distinction), 968ac9d (regressions).

IMPORTANT: Two different source ID strings are merely two asserted identifiers, not proof of independent authoritative calendars. Even `consistent: true` is only agreement between syntactically valid claims. It does not establish trading-day truth, data rights, or permission to finalize observations. Dedicated GitHub eligibility workflow still not separately confirmed. Vercel Preview test-first gate is in place, but the new comparison tests must pass in the latest build before declaring them verified.

No main/production, AI POWER, notifications, scheduler, order execution, licensed provider integration, or persistent dev DB changes.
