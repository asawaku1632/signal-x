# Dual Surge historical-bar safety checkpoint — 2026-10-25

## Committed
- The pure historical outcome functions now fail closed with EXCLUDED_MISSING_DATA on null intermediate bars.
- Numeric price fields are explicitly type-checked, preventing numeric strings from being accepted in outcome calculations.
- Three new synthetic tests cover null intermediate bar, string close and string entry open.

## Status
- 126 test definitions recorded (123 previous + 3 new).
- Full suite pass on the actual GitHub branch is not verified.
- 24-event source replay is still blocked by lack of authorized immutable event-level evidence. Arithmetic checks on the frozen aggregates are not a substitute.
- STEP 140 remains incomplete until CI and event-level reconciliation are verified.

## Boundaries
No production/main merge, automated data collection, database mutation, cron or notification changes.
