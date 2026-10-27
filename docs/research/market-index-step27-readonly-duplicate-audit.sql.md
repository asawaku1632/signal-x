# STEP27 — Development DB duplicate audit (read-only)

Scope: `signal-x-dev` Supabase project `jdtqwryiyxeuoraecorw` **only**. Run manually in its SQL Editor. This is not a scheduled job.

## Read-only SQL

```sql
-- STEP27 / development DB only / SELECT only
-- Date+index+reason groups for provider approval unavailable status
WITH grouped AS (
  SELECT
    (checked_at AT TIME ZONE 'Asia/Tokyo')::date AS jst_date,
    index_key,
    reason,
    COUNT(*)::bigint AS saved_count
  FROM public.market_index_research_runs
  WHERE reason = 'PROVIDER_APPROVAL_REQUIRED'
  GROUP BY 1, 2, 3
)
SELECT
  jst_date,
  index_key,
  reason,
  saved_count,
  CASE WHEN saved_count = 1 THEN 'OK' ELSE 'DUPLICATE' END AS result
FROM grouped
ORDER BY jst_date DESC, index_key;
```

## Interpretation
- `OK`: exactly one row for the date, index and reason.
- `DUPLICATE`: more than one row; investigate before further writes.
- `No rows returned`: no matching records, **not** a pass for data capture.
- This query audits only `PROVIDER_APPROVAL_REQUIRED` records, not other reasons, other tables, price data, or concurrent race guarantees.
- If the schema differs or query errors, do not modify tables automatically; inspect schema first.

## Operating procedure
1. Confirm the SQL Editor URL contains project `jdtqwryiyxeuoraecorw` (never production project `paygtakajhvatwejygda`).
2. Run the query manually. It performs no INSERT, UPDATE, DELETE, DDL or external API call.
3. Record run time (JST), result rows, duplicate group count, and reviewer in a separate dated audit record.
4. If any `DUPLICATE`, stop additional save tests and investigate. Do not delete rows without explicit review.
5. Do not enable Cron, market feed collection, AI POWER, notification, or orders.

## Acceptance criteria
- All returned groups show `OK`.
- On 2026-10-27 the previously user-verified nikkei count was 1; later results must be observed, not presumed.
- This is a **manual** audit procedure. Periodic automation would require a separate approved design and explicit authorization.

Reference: [STEP27 evidence-to-use register](./market-index-step27-evidence-to-use-register-2026-10-27.md).
