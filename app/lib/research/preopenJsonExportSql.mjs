/** Read-only bounded SQL template. Manually run only after authorization.
 * The returned rows are not proof of quote provenance or trading eligibility.
 */
export const PREOPEN_JSON_EXPORT_SQL_V1=`
SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.trade_date), '[]'::jsonb) AS approved_preopen_rows
FROM (
 SELECT trade_date::text AS trade_date, captured_at::text AS captured_at, quotes
 FROM public.morning_market_forward_runs
 WHERE trade_date BETWEEN '2026-10-21' AND '2026-10-29'
 ORDER BY trade_date
 LIMIT 100
) x
`;
export function describePreopenJsonExport(){
 return {readOnly:true,executesSql:false,bounded:true,sourceAuthenticated:false,signalsEnabled:false};
}
