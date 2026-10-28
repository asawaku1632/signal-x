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

## Practical next step: first real research cohort (blocked until rights are verified)
1. Obtain an explicitly authorized breadth dataset containing timestamped Nikkei/TOPIX changes and Prime advance/decline/unchanged counts. Record provider, redistribution/storage permissions, coverage, and observation-time provenance. No inferred licensing.
2. Obtain independently timestamped SIGNALX signal records, with immutable signal IDs and generated-at timestamps. Existing capture timestamps alone are not acceptable proof of original signal time.
3. Obtain licensed forward close/adjusted-price records and an independently verified TSE session calendar; match each signal to exactly five subsequent trading sessions, without calendar-day substitution or retrospective re-labeling.
4. Run the pure research review pipeline against a manually supplied, approved fixture in an isolated environment. Preserve accepted and rejected evidence IDs, reasons, cohort sample counts, and per-day/symbol coverage. Do not persist into production or enable notifications.
5. Require >=30 accepted observations and >=10 trading days in each cohort merely to display a provisional comparison; promotion readiness separately requires >=100 observations, >=20 days, >=30 symbols per cohort and independent reproducibility/human review. These floors are safety thresholds, not evidence of predictive value.
6. If no approved dataset exists, report BLOCKED with zero validated samples and request provider approval rather than generating synthetic observations as if real.

## Research question and decision criterion
Hypothesis: when Nikkei rises but TOPIX is flat/down and at least 60% of observed Prime issues decline, five-session outcomes of SIGNALX candidates differ from ordinary breadth conditions. Measure mean and median return, positive rate, confidence intervals, and concentration by symbol/date before claiming an effect. Treat any observed difference as descriptive until an out-of-sample, time-separated validation is completed. Do not alter production scoring from this PR.
