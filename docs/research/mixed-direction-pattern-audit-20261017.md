# Mixed-direction chart pattern safety regression

This research-only check is intentionally read-only and does not modify AI POWER, production tables, or notifications.

## SQL audit

Run against a read-only production connection:

```sql
SELECT pattern_id,
       direction,
       COUNT(*) AS detected,
       COUNT(return_5d) AS completed_5d,
       COUNT(*) FILTER (WHERE success_5d IS TRUE) AS hits
FROM public.pattern_forward_observations
WHERE pattern_id IN (
  SELECT pattern_id
  FROM public.pattern_forward_observations
  GROUP BY pattern_id
  HAVING COUNT(DISTINCT direction) > 1
)
GROUP BY pattern_id, direction
ORDER BY pattern_id, direction;
```

## Invariant

The validated-bonus lookup in `app/lib/learning/patternForwardLearning.ts` must reject any `pattern_id` that has even one observation whose direction differs from the direction recorded in `pattern_forward_stats`. Mixed patterns may be shown for research but must not receive the pooled AI POWER bonus.

The admin display in `app/admin/pattern-performance/page.tsx` reports detected, completed and directional hits separately for BUY and SELL, while NEUTRAL is not scored as a directional hit.

Do not merge until the PR's Next.js build and offline checks pass.

## Read-only production check (2026-10-17)

- 41 observed pattern IDs; one mixed-direction ID (`pattern045`).
- Among patterns with at least 50 completed five-day outcomes, none currently passes the old date-diversity threshold while failing the new completed-date threshold. Likewise, no pattern with at least 20 outcomes meets the old early-diversity thresholds while failing the new completed-diversity thresholds.
- The largest completed cohorts currently have only **one distinct completed trade date**: `pattern002` 493 completed outcomes, `pattern006` 190, `pattern048` 178. `pattern045` has 337 completed outcomes pooled across three directions, also from one completed trade date.
- Therefore no five-day pattern should be treated as validated across independent market dates. The new eligibility rule is preventive rather than a retroactive downgrade of currently validated patterns.
- Queries were SELECT-only against production; no writes, refreshes, or deployments.

## Follow-up read-only quality and maturity audit (2026-10-17)

- 12,160 observations checked: invalid entry prices 0; missing five-day outcome dates 0; outcome date without return 0; missing BUY/SELL directional score 0; incorrectly scored NEUTRAL observations 0; nonfuture outcome dates 0.
- BUY five-day win/loss sign mismatches 0; SELL sign mismatches 0; fifth subsequent per-stock saved-session rank mismatches 0; future outcome dates 0.
- Three five-day observation rows exceeded +100%, **all the same stock/date**: code `3909`, detected 2026-10-08 at 296, fifth-day 2026-10-16 at 675 (+128.0405%). The same stock contributed three pattern IDs (`pattern043`, `pattern002`, `pattern018`). Daily saved price series was 296, 389, 469, 549, 568, 675 across six saved dates. This is internally consistent but **not independently verified against an external adjusted-price or corporate-action source**. Avoid counting these three pattern rows as three independent stock-level events in cross-pattern claims.
- 2026-10-09 cohort has four later saved sessions as of 2026-10-16; not yet due for five-day outcome. 2026-10-08 cohort has five later sessions and all 2,156 outcomes completed.
- Admin page now shows per-date cohort counts, subsequent saved-session count, and an explicit overdue-review label only when five saved sessions exist but the cohort remains incomplete. It is a **candidate review flag**, not proof of processing failure (stock-specific missing data can matter).
- All production queries were SELECT-only. No production DB writes, scan execution, or deployment.
