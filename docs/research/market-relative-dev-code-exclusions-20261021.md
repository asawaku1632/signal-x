# Development BB code-format exclusions (read-only, 2026-10-21)

Read-only aggregate query on development project `jdtqwryiyxeuoraecorw` identified all five BB rows failing the four-digit stock code rule:

| Stored code | Count |
|---|---:|
| `__DEV_BB_TRANSITION_47__` | 4 |
| `__DEV_BB_MISSING_47__` | 1 |

These strings are development-only identifiers, not ordinary Japanese four-digit stock codes. They must remain excluded from market-relative stock return cohorts; never coerce them into ticker symbols. 420 of 425 BB rows satisfy **code format only**, not overall eligibility. Signal timestamp, exit price/timestamp, and matched benchmark prices remain unverified/missing for historical BB events.

CI run 39581799005: contract and provider-probe jobs succeeded, including 9 BB audit projection checks; total 115 synthetic/contract checks passed. Provider-probe success does not establish TOPIX intraday availability.

No production access, database mutations, live ingestion, or notifications changed.
