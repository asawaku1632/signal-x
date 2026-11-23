# MM shadow audit — 2026-11-01

Production read-only SQL joined `momentum_memory_observations` and `daily_stock_results` by code for base 2026-09-18 and candidate fifth-session 2026-09-30.

- Flagged observations: 18; comparable: 18; differences greater than 0.01 percentage points: 18.
- Mean stored 5d result: -0.7283%; candidate price-based mean: -1.9086%; mean delta: -1.1804 percentage points.
- Calendar provenance, price timestamps and completeness have NOT yet been independently verified. Treat this as a provisional discrepancy audit, not a corrected performance claim.
- Production MM benchmark_5d values were all NULL in the inspected date groups (2026-09-18 through 2026-10-30).
- Multi-cohort follow-up query was blocked by safety check; no other cohort results claimed.
- No production changes, data backfill, notification release or added costs.
