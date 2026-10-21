# SIGNALX — 買いシグナル失敗・下落後回復研究 (2026-10-21)

Status: research design only; no production database, cron, notifications, trading logic, or public UI changes.

## Purpose
Study (A) adverse movement after a buy-condition signal and (B) recovery after an adverse move. Results are descriptive historical evidence, not personalized hold/sell instructions or a probability forecast.

## Frozen event ledger
For each eligible signal, record immutable event ID, ticker, signal type/version, evaluation timestamp (JST and UTC), observable signal price and source, quote timestamp/freshness, AI score, volume and available features, market session, and a versioned condition snapshot. Preserve missing/unavailable values; never silently backfill with future knowledge.

A separate adverse-event ledger records first observed threshold breach (e.g. -3%, -5% versus frozen reference), observation time, market session, contemporaneous price/source, and the linked signal ID. Deduplicate per signal/threshold and preserve original timestamps. Capture all qualifying events, including delisted/stale/unavailable cases.

## Forward outcomes
At 1, 3, 5, 10 and 20 trading sessions, independently capture reference close, open (when reliable), highest/lowest observed price, data quality and corporate-action adjustment status. Distinguish:
- positive return versus the adverse-event reference price;
- return to the original signal price;
- return to an individual acquisition price (only when explicitly provided and isolated from aggregate research);
- max adverse excursion before recovery, recovery time, and never-recovered/censored cases.
Record calendar/market holidays and avoid pretending that intraday high means executable fill.

## Research cohorts and controls
Compare signals with similar observable AI scores, volatility, volume, gap, sector, market conditions and time of day. Include failed signals, pending outcomes and data gaps; publish cohort size and confidence intervals. Prevent overlapping observations from inflating sample size; compare with baseline and out-of-sample chronological holdouts. Evaluate survivorship bias, corporate actions, and transaction costs.

## Example investigation
3762 on 2026-10-21: user screenshot at 14:10 shows 3,310 JPY and unrealized -10,500 JPY on 100 shares (implied average acquisition 3,415 JPY). This is an illustrative case, NOT a verified signal event; do not insert as historical signal without original timestamp, signal snapshot and price provenance. SIGNALX screenshot flags saved/stale data; treat freshness as unverified.

## Admin-only UI proposal
Two private sections: "買いシグナル失敗研究" and "下落後の回復研究". Show event counts, complete/pending/missing cohorts, 1/3/5/10/20-session results, median returns, recovery rates, drawdown distributions, and comparable historical cases. Label small samples and stale data prominently. Never label descriptive frequencies as future win probabilities.

## Rollout gates
1. Audit existing signal snapshots, data contracts, cron and owner authorization.
2. Implement independent read-only preview with fixtures; verify frozen-time data contract and no future leakage.
3. Add append-only storage and scheduled observations after schema/RLS review and staging tests.
4. Run shadow collection; inspect data completeness, cron reliability, and corporate-action handling.
5. Enable owner-only research dashboard after independent validation.
6. Any connection to public AI rankings, recommendations or LINE notifications requires separate explicit approval and out-of-sample evidence.

Acceptance: existing SIGNALX behavior unchanged; no production write from this design branch; owner-only data boundaries; deterministic tests for missing/stale prices, market holidays, duplicates, price adjustments and no future leakage.
