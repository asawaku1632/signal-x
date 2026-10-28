# Existing development-data reuse audit — 2026-10-28

Research-only inspection of **development** Supabase project. All queries were SELECT only. This document is a point-in-time inventory, not evidence of signal accuracy or data-provider rights.

## Exact counts
| Table | Rows | Coverage |
|---|---:|---|
| bb_signal_events | 425 | 7 signal dates; 422 codes |
| technical_signal_events | 313 | 1 signal date; 312 codes |
| bb_signal_event_results | 5 | 5 evaluated dates; 2 event IDs |
| technical_signal_event_results | 0 | none |
| dual_surge_shadow_candidates | 0 | none |
| bb_daily100_signals | 0 | none |
| market_relative_prospective_ledger | 0 | none |
| market_index_shadow_observations | 0 | none |
| us_economic_market_observations | 0 | none |

## Timestamp mismatch
- All 425 BB events were written on 2026-08-11 UTC within roughly one minute; their signal dates span 2026-04-24 through 2026-08-10. **Zero** have JST(created_at) matching signal_date. created_at is not independent signal generation proof.
- All 313 technical events have signal_trade_date 2026-08-14, but detected_at ranges 2026-08-15 through 2026-08-16 UTC. **Zero** have JST(detected_at) matching signal_trade_date. All 313 have positive entry prices, but this does not establish contemporaneous price provenance.
- Do not reclassify these 738 rows as forward-real-time predictions, do not backdate timestamps, and do not use them to claim AI POWER improvements.

## Actual blockers
1. Find immutable independently timestamped signal records, not retrospectively created records.
2. Verify market breadth observations, original observation timestamps, and permitted provider rights.
3. Verify each five-session outcome using licensed data and an exchange trading calendar.
4. Only then feed independently attested rows into the offline research bundle and report exclusions.
5. Keep historical events as **retrospective descriptive** material unless independent provenance is recovered. Do not write to production or enable notifications.

## Next practical priority
Instrument prospective independent signal capture only after explicit authorization and provider-rights review. Do not deploy or enable automatic collection from this audit.
