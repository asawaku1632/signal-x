# Market breadth research: actual data path and eligibility

## Existing development DB inspection (2026-10-28)
- public.market_index_research_runs: 4 rows, all unavailable, provider_rights_verified=false, observed_at/value null, reason PROVIDER_APPROVAL_REQUIRED.
- public.market_index_research_audit_history: 1 audit record, PASS refers to duplicate/group audit only, not provider approval.
- public.market_index_shadow_observations: 0 rows.
- public.market_relative_prospective_ledger: 0 rows.
- public.swing_universe_observations: 0 rows.
- No approved breadth feed or verified five-session outcomes were established. These counts are point-in-time development DB observations, not production claims.

## Strict processing contract
1. Licensed provider must supply actual observed-at timestamp, Japanese trading date, Nikkei and TOPIX percentage changes, advance/decline/unchanged counts, and source/license evidence.
2. Classifier fails closed for missing/invalid fields. Do not turn index levels into daily percentage changes without independently verified baseline.
3. Read-only as-of join selects the latest uniquely timed, licensed breadth observation strictly BEFORE each independently timestamped signal. Same-time duplicates are quarantined.
4. The five-session outcome must come from an independently verified licensed source, with TSE trading calendar verification; never infer five sessions from five calendar days.
5. Compare outcomes by divergence cohort only after both cohorts have verified observations. Report sample size, unique days, mean/median, positive rate, and rejection counts.
6. No automatic production promotion, ranking adjustment, trading decisions, or notifications. Explicit review and separately authorized production deployment required.

## Current gate
BLOCKED: provider approval and valid snapshots/outcomes unavailable. Do not backfill synthetic data or scrape unlicensed market feeds.
