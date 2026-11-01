# MM TOPIX benchmark readiness (2026-11-01)

Research-only audit. No production changes.

## Verified read-only production observations
- market_learning_logs: 74 rows; zero non-null nikkei, topix, usd_jpy and vix values.
- October 1-30: 21 distinct saved dates, one row each.
- MM forward flagged: 53 candidates; 50 completed five-day outcomes; zero benchmarked.

## Verified code findings
- saveRelatedLearning calls summarizeMarketLearning without indices.
- Both market-learning upserts previously erased stored indices when incoming fields were null; research PR #298 changes these to COALESCE.
- MM benchmark now chooses the fifth distinct logged date and requires TOPIX on that date. Logged dates are NOT a verified exchange calendar.
- Crash-strength shadow code relies on actual Nikkei or TOPIX daily bars to confirm trading sessions, but this is not a reusable verified calendar feed.

## Release blockers
1. Obtain licensed, dated TOPIX daily close values and provenance, without paid-service activation.
2. Independently verify trading calendar completeness and all intervening sessions.
3. Keep historical backfills separate from 09:05 as-of data.
4. Test missing sessions, holidays, duplicate observations, missing index values and chronology.
5. Compare forward MM returns with the matched TOPIX five-session return in shadow mode; do not release notifications before independent validation.

Status: BLOCKED. No trading edge claimed.
