# STEP27 research audit — 2026-10-27 (JST)

## Scope
- Repository: asawaku1632/signal-x
- Branch: research/market-index-shadow-20261021
- Environment: research Preview, development Supabase project `signal-x-dev` (`jdtqwryiyxeuoraecorw`)
- Index: `nikkei`
- Record type: provider-unavailable status only (`PROVIDER_APPROVAL_REQUIRED`), **not index prices**.
- Evidence: administrator-provided API responses and read-only SQL results. No independent execution of the user-side SQL by the author.

## Earlier baseline
Read-only grouped SQL for `reason='PROVIDER_APPROVAL_REQUIRED'` returned:
| JST date | Index | Rows |
| --- | --- | ---: |
| 2026-10-23 | nikkei | 1 |
| 2026-10-23 | topix | 1 |
| 2026-10-22 | nikkei | 1 |

No duplicate groups in the displayed results.

## Manual save / retry (2026-10-27)
The administrator executed the new UI twice:
| Attempt | HTTP | success | alreadySaved | persistedRows | writeVerified |
| --- | ---: | --- | --- | ---: | --- |
| First | 200 | true | false | 1 | true |
| Second | 200 | true | true | 0 | true |

Both responses: `mode=PREVIEW_UNAVAILABLE_STATUS_SAVED`, `indexKey=nikkei`, `marketDataCaptured=false`, `scheduledCaptureConfigured=false`, `rollbackVerified=false`.

## Independent DB count corroboration
The administrator ran read-only SQL grouping by JST date and index with `reason='PROVIDER_APPROVAL_REQUIRED'` and returned:

```json
[{"jst_date":"2026-10-27","index_key":"nikkei","saved_count":1}]
```

**Decision: PASS — sequential same-day, same-index manual save deduplication**, supported by both API responses and a DB count of one persisted row.

## Related earlier isolated transaction test
Administrator-provided Preview test reported `firstLockAcquired=true`, `concurrentBlocked=true`, `committed=true`, `retryAcquired=true`, `retrySawCommittedRow=true`, `duplicateSkipped=true`, `cleanupVerified=true`. This is a separate temporary-row test, not proof of all concurrent manual-save scenarios.

## Boundaries and open items
- The manual-save status row is persistent in the **development** database; this audit does not delete it.
- No actual Nikkei/TOPIX price data was fetched or validated.
- Licensed provider terms, market calendar, freshness of live prices, and commercial use remain unverified.
- No production database mutation, production AI POWER/notifications/orders integration, or scheduled capture is authorized by this audit.
- Further stress/concurrency verification and production readiness require separate approval and evidence.
