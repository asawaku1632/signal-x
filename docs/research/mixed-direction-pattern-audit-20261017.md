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
