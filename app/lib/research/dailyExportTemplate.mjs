/** Read-only SQL template for a manual, authorized export. Never executes SQL.
 * Missing provenance is emitted as false/null, not invented or inferred.
 * Review scope and access policy before running in an external SQL console.
 */
export const RESEARCH_EXPORT_SQL_V1=`
WITH previous_observations AS (
 SELECT d.id,d.date,d.code,d.price,d.next_price,d.score,
        lag(d.date) OVER(PARTITION BY d.code ORDER BY d.date) AS prior_date,
        lag(d.score) OVER(PARTITION BY d.code ORDER BY d.date) AS prior_score
 FROM public.daily_stock_results d
), source_rows AS (
 SELECT d.id,p.source_trade_date,p.source_price,p.source_snapshot_created_at
 FROM public.daily_stock_results d
 LEFT JOIN public.daily_result_price_provenance p ON p.daily_result_id=d.id
)
SELECT d.date,d.code,d.price,d.next_price,d.prior_date,d.prior_score,
       p.source_trade_date AS source_date,p.source_price,
       p.source_snapshot_created_at AS source_snapshot_created_at,
       NULL::text AS prior_available_at,
       false AS prior_evidence_verified,
       false AS outcome_provenance_verified
FROM previous_observations d
LEFT JOIN source_rows p ON p.id=d.id
WHERE d.date >= '2026-09-02'
ORDER BY d.date,d.code
LIMIT 100000
`;
export function describeResearchExport(){
 return {version:"RESEARCH_EXPORT_TEMPLATE_V1",readOnly:true,executesQueries:false,
  featuresVerified:false,outcomesVerified:false,
  note:"Template intentionally leaves unavailable as-of timestamps and independent verification false. Never enable analysis by filling flags without source evidence."};
}
