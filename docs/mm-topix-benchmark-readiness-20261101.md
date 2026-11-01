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

## Additional production calendar audit
- Logged non-session dates include 2026-07-19 (Sunday), 2026-07-20 (Marine Day), 2026-08-11 (Mountain Day), 2026-09-21 (Respect for the Aged Day), and 2026-09-22 (citizens' holiday).
- Weekend-only filtering does NOT exclude the four weekday holidays above.
- July 7 to July 20 has a substantial logging gap; the fifth *logged* weekday is not necessarily the fifth exchange session.
- Consequently the provisional fifth-logged-weekday query MUST NOT be treated as a verified five-exchange-session benchmark. Keep benchmark/notification release blocked until independent session calendar coverage is proven.

## Stock-outcome horizon audit
- The production daily_stock_results table contains 955 distinct codes on each of 2026-09-21 and 2026-09-22, despite both being exchange holidays.
- updateMomentumMemoryOutcomes currently selects OFFSET 0/2/4 from saved daily_stock_results rows for each code, without verified exchange-session filtering.
- A read-only October duplicate (code,date) check returned no duplicate groups, but this does not fix holiday rows or missing real sessions.
- Thus existing result_1d/result_3d/result_5d are NOT yet proven to be actual exchange-session forward returns. Treat them as provisional; do not rewrite historical outcomes without a verified calendar and explicit remediation plan.
- Any future benchmark comparison must use the exact same independently verified fifth exchange-session date as the stock return.
