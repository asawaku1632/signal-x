# Morning research → shadow notification gate (offline only)

## Current status
No automatic notification or trading is enabled by this module. The gate always
returns BLOCKED until an independently audited chronological baseline and a
separate release authorization process exist. No production database writes,
network calls, cron jobs, push subscriptions or trading orders are performed.

## Six-stage evidence flow
1. Source inventory and schema/timestamp validation.
2. Separate daily technical snapshots from complete 09:00–11:30 JST five-minute outcomes.
3. Construct candidate research cohorts with provenance, unique stock-days and exclusions.
4. Run leakage-safe chronological forward evaluation using matured outcomes.
5. Compare the model against an independently computed *past-only* baseline,
   including Brier score, positive rate, mean/median 5-day returns and market regimes.
6. Only after independent source/license review, statistical review and explicit
   human approval consider a separate shadow-notification release. This code cannot
   activate it.

## Input contract
evaluateMorningShadowGate(rows) takes offline records:
code, tradeDate, forward5dReturnPct, predictedProbability (0..1), regime,
independentlyVerified, pointInTimeVerified, outcomeMatured, outOfSample.
The four proof booleans are **caller assertions**, not independent verification.
Never populate them based solely on a data provider label, row timestamp, or
database insertion time. Duplicates and invalid records are counted and blocked.

Default research thresholds are provisional and **not evidence of performance**:
100 candidates, 20 stocks, 30 trading days, 3 months, 2 market regimes,
15 samples per regime, positive rate >= 55%, positive mean and median,
Brier <= 0.25. These do not override the unconditional chronological-baseline
block or authorize notifications.

## Known limitations
The development database's six observed daily BB snapshots do not provide
complete morning 5-minute outcomes. Existing shadow tables were empty when
last checked. No genuine performance result or live notification readiness can
be inferred from these observations. The in-sample constant-rate Brier baseline
is diagnostic only; chronological baseline lift is deliberately null.
