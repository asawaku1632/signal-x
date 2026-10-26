# Existing daily AI accuracy pipeline — source audit (2026-10-26)

## Confirmed from repository source (not DB execution)
- `app/lib/learning/accuracyEvaluator.ts` reads `daily_stock_results` and resolves the first present score column among `ai_power, score, final_score, ai_score, power_score`.
- The evaluator uses existing `result IN ('WIN','LOSE','HOLD')` to group S(85+), A(70–84), B(50–69), C(0–49) and reports WIN/(WIN+LOSE).
- `app/api/learning/accuracy-evaluate/route.ts` accepts `mode=preview|execute`; the evaluator itself does not write to DB. However the route does **not** call `getAdminSession`, and the response includes `nextAction` language implying saving an evolution log in execute mode, which this evaluator does not do. This is a potential information-exposure and misleading-state issue, requiring a separate reviewed fix.
- `app/api/admin/research-lab/route.ts` has admin gating and reads `momentum_memory_observations`, `high_ai_pullback_observations`, `ai_reversal_observations`, `trend_pullback_reversal_observations` (1/3/5-day results). Its `VALIDATED` status is a threshold-based dashboard label, **not** proof of independent holdout, licensed provenance or causal improvement.
- `app/lib/learning/learningSaveStatus.ts` reads `daily_stock_results` and logs; `latestConfirmedDate` is explicitly null.

## Critical gaps to address before automatic AI updates
1. Current WIN/LOSE/HOLD labels are not shown here to be derived from independently licensed and corporate-action-adjusted J-Quants +5/+10/+20 trading-day closes. Need lineage.
2. The accuracy evaluator has no date window, maturity accounting, benchmark, deduplication, holdout or uncertainty estimates. It must not trigger automatic score boosts.
3. Score-column fallback can silently select a different meaning of score across schemas; freeze a verified canonical column before comparisons.
4. Missing evidence and HOLD handling may inflate precisionRate; do not equate `(WIN+HOLD)/total` with profitable trades.
5. The `mode=execute` wording should not imply persistence where none occurs.
6. API authentication/authorization should be reviewed before exposing sensitive research summaries.

## Next safe implementation
- Identify actual columns and data lineage of `daily_stock_results` from migrations and saving code.
- Add a **new isolated read-only** chronological evaluation with explicit missing/outcome denominators, and no writes to rankings or notification rules.
- Validate on a genuinely separate later period before considering promotion.
- No live J-Quants API calls, DB writes, or scoring changes authorized by this audit.

## Status
Repository source audited. Database rows, permissions and licensed data usage not verified; no performance claims.
