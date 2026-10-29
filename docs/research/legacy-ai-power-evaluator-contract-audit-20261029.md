# AI POWER accuracy evaluator: code-contract audit (2026-10-29)

Source reviewed: `app/lib/learning/accuracyEvaluator.ts` and `app/api/learning/summary/route.ts`.

## What the code actually does
- `resolveScoreColumn()` chooses the first present field from `ai_power, score, final_score, ai_score, power_score`. The same UI can therefore measure a different field depending on database schema.
- It groups resolved `WIN/LOSE/HOLD` rows into score bands: S >=85, A >=70, B >=50, C >=0. It reports a WIN / (WIN+LOSE) rate, excluding HOLD from that denominator.
- `precisionRate` is (WIN+HOLD)/total, which is **not conventional predictive precision**. It must not be interpreted as a statistically calibrated probability.
- `minJudgedCount` defaults to 5, far too small for a reliable deployment decision; band-level `BOOST`/`REDUCE` recommendations are heuristic labels only.
- `mode='execute'` changes the returned `nextAction` string but the inspected evaluator function does not itself write weights, save an evolution log, or retrain the model. No automatic training effect is established by this function.
- The `summary` API computes historical descriptive counts and WIN/(WIN+LOSE), not an independently validated future strategy return.
- Source does not enforce an out-of-sample time split, evaluation horizon, provenance, transaction costs, regime stratification, or a frozen baseline in the evaluator.

## Consequences
The learning page can be genuinely useful as an inventory of recorded outcomes, but its score-band ranking and AI improvement language are not sufficient evidence that SIGNALX has become more predictive. These historical results should be treated as candidate research material and audited before training, notification promotion, or trading guidance.

## Next research gate
1. Identify authorized, nonproduction `DATABASE_URL` database or sanitized export.
2. Run the aggregate-only audit in `legacy-daily-stock-results-readonly-audit-20261029.sql`.
3. Obtain trustworthy original signal timestamps and independent 1/3/5-session outcomes, quarantine ambiguous legacy rows.
4. Freeze a baseline and candidate rule; evaluate date-disjoint holdout with embargo, transaction costs and market-regime checks.
5. Promote only after evidence supports an improvement. **No production modification or automatic weight adjustment is authorized.**
