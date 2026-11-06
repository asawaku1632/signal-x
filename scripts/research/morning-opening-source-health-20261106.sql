-- RESEARCH ONLY / SELECT ONLY. Frozen 2026-11-06 diagnostic window.
-- Historical reasons do not reveal which opening slot was missing; the new
-- quoteEvidence field is append-only for FUTURE captured mornings.
WITH observations AS (
 SELECT f.trade_date,f.morning_state,f.morning_claimed_at,
   item.value->>'label' AS label,
   coalesce(item.value->>'quoteReason','UNSPECIFIED') AS recorded_reason,
   item.value->'quoteEvidence' AS source_evidence
 FROM public.morning_final_check_runs f
 CROSS JOIN LATERAL jsonb_array_elements(f.morning_observations) AS item(value)
 WHERE f.trade_date BETWEEN DATE '2026-10-21' AND DATE '2026-11-06'
)
SELECT recorded_reason, count(*) AS observed_stock_days,
  count(DISTINCT trade_date) AS affected_days,
  count(*) FILTER (WHERE label='BUY_CANDIDATE') AS buy_candidate_count,
  count(*) FILTER (WHERE source_evidence IS NOT NULL) AS has_precise_asof_provenance,
  min((morning_claimed_at AT TIME ZONE 'Asia/Tokyo')::time) AS first_claim_jst,
  max((morning_claimed_at AT TIME ZONE 'Asia/Tokyo')::time) AS last_claim_jst
FROM observations GROUP BY recorded_reason
ORDER BY observed_stock_days DESC,recorded_reason;
