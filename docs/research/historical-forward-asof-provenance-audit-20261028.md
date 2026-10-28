# Historical forward study: as-of provenance gate (2026-10-28)

## Verified read-only evidence

Production `pattern_forward_observations` had 12,160 completed 5-day outcomes across six observation dates, 2026-10-08, 09, 13, 14, 15 and 16. All 12,160 original `entry_price` values match same-date `daily_stock_results.price`; both have dates aligned with the observation. The latter confirms internal consistency **not** independent historical immutability.

In `app/api/learning/save-daily/route.ts`, daily save fetches `/api/scan?limit=1000`, saves daily stocks and then calls `savePatternForwardObservations` with that scan output. The forward table does not persist per-stock `dataSource`, `latestBarTimestamp` or the scan receipt timestamp.

`dailySavePriceSourceAudit.ts` writes a diagnostic summary into `cron_run_logs.details.priceSourceAudit`, explicitly documenting that bar time is not receipt time or proof of final exchange close. For October 13–16 the audit showed 953 intraday observations per day, no missing bar timestamps, and median bar ages of 20.6 minutes at a save around 15:35 JST. Bar timestamps clustered at 15:15 JST but some individual bars were substantially earlier. Summary stats alone cannot prove the exact bar time for all 12,160 pattern observations. Audit logs for October 8 and 9 were not found by the specific audit query.

A separate `daily_learning_price_reference_audits` comparison matched 97 pattern observation records (45 distinct audit rows), with every matched observation baseline within 0.001 JPY. The 92 `MISMATCH` statuses among the joined rows compare baseline against later Yahoo reference values, **not** against the stored pattern entry. Repeated pattern observations referencing one audit must not be described as 97 independent source verifications.

## Safe classification

- `INTERNAL_ASOF_CANDIDATE`: same-day scan-derived observations with internally matching daily prices, but no immutable independent per-stock provenance.
- `SOURCE_TIME_UNVERIFIED`: individual bar timestamp, original snapshot revision history, provider and licensing not independently established.
- `OUTCOME_REFERENCE_NEEDS_AUDIT`: daily future prices likewise internally aligned, but not proven finalized close or appropriate as-of reference.
- No existing historical row is approved for production AI POWER feedback or commercial model-performance claims based solely on these checks.

## Next analysis priority

Recover archived scan payloads or per-stock logs with original `latestBarTimestamp` and `dataSource` for the six dates; verify exact bar time and immutable input price per stock. Then recalculate 5-session outcomes using independently audited same-session prices, deduplicate at stock-date and compare patterns across different dates. Do not confuse a ~15:15 JST quote bar with the 15:30 JST final close.

All SQL analysis was SELECT-only; no production mutations.
