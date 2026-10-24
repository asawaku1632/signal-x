# Development dataset exclusions — read-only audit, 2026-10-21

Project: development Supabase `jdtqwryiyxeuoraecorw`. SQL aggregate counts only; no writes or production access.

| Dataset | Total | Missing AI POWER snapshot | Invalid stock code (not four digits) | Invalid entry price |
|---|---:|---:|---:|---:|
| `bb_signal_events` | 425 | 0 | 5 | 0 |
| `technical_signal_events` | 313 | 313 | 0 | 0 |

BB event date was non-null in all 425 rows. The BB source does not independently establish the exact original signal timestamp, exit prices, or timestamp-matched benchmark observations. The 425 BB events **cannot** be treated as 425 eligible market-relative returns. Five BB codes also fail the current four-digit contract; investigate instrument identifiers before considering any normalization.

The 313 technical events have no stored `display_ai_power_snapshot`, so they cannot be assigned to frozen AI POWER cohorts. Do not substitute a current score or a reconstructed score.

These counts are **per-column**, not disjoint record exclusions; do not sum them to infer a unique excluded count. Full eligibility requires a row-level audit and future outcomes. No predictive accuracy, win rate, or actual excess return can be established from this audit.

Next: inspect code formats and original snapshot provenance, confirm market-data rights and timestamps, and design a limited read-only row-level adapter. No ingestion cron or production changes.
