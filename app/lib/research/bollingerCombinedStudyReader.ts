import "server-only";
import pool from "@/app/lib/postgres";
import {evaluateCombinedResearch} from "./bollingerCombinedStudy.mjs";

type FrozenRow={
 detector_version:string;code:string;signal_time:string;group_key:string;
 horizon:number;return_percent:string;max_adverse_percent:string;
 rsi_group:string;trend_group:string;breakout_group:string;volume_bucket:string;
};
type CountRow={
 base_outcomes:number;expansion_outcomes:number;verified_base_volume:number;factors:number;
};
const COMBINED_SQL=`
 WITH verified_base AS (
  SELECT o.detector_version,o.code,o.signal_time,o.group_key,o.horizon,
   o.return_percent,o.max_adverse_percent,v.volume_bucket
  FROM public.bb_breakout_shadow_outcomes o
  INNER JOIN public.bb_breakout_volume_factors v
   ON v.detector_version=o.detector_version AND v.code=o.code
     AND v.signal_time=o.signal_time
  INNER JOIN public.bb_breakout_shadow_outcomes frozen_1d
   ON frozen_1d.detector_version=v.detector_version
     AND frozen_1d.code=v.code AND frozen_1d.signal_time=v.signal_time
     AND frozen_1d.horizon=1
     AND frozen_1d.source_hash=v.original_source_hash
 ),
 all_original AS (
  SELECT detector_version,code,signal_time,group_key,horizon,
   return_percent,max_adverse_percent,volume_bucket FROM verified_base
  UNION ALL
  SELECT detector_version,code,signal_time,group_key,horizon,
   return_percent,max_adverse_percent,volume_bucket
   FROM public.bb_breakout_expansion_outcomes
 )
 SELECT o.detector_version,o.code,o.signal_time::text,o.group_key,o.horizon,
   o.return_percent::text,o.max_adverse_percent::text,o.volume_bucket,
   f.rsi_group,f.trend_group,f.breakout_group
 FROM all_original o
 INNER JOIN public.bb_asof_factors f
  ON f.detector_version=o.detector_version
   AND f.code=o.code AND f.signal_time=o.signal_time
 WHERE o.detector_version='BB_BREAKOUT_SHADOW_V1'
 ORDER BY o.signal_time,o.code,o.horizon
 LIMIT 6001
`;
const COUNT_SQL=`
 SELECT
  (SELECT COUNT(*)::int FROM public.bb_breakout_shadow_outcomes
   WHERE detector_version='BB_BREAKOUT_SHADOW_V1') AS base_outcomes,
  (SELECT COUNT(*)::int FROM public.bb_breakout_expansion_outcomes
   WHERE detector_version='BB_BREAKOUT_SHADOW_V1') AS expansion_outcomes,
  (SELECT COUNT(*)::int FROM public.bb_breakout_volume_factors
   WHERE detector_version='BB_BREAKOUT_SHADOW_V1') AS verified_base_volume,
  (SELECT COUNT(*)::int FROM public.bb_asof_factors
   WHERE detector_version='BB_BREAKOUT_SHADOW_V1') AS factors
`;
/** Existing frozen results only. No price vendor/API calls, no DB writes,
 * no service-role changes, no Cron or live trading side effects.
 */
export async function getCombinedBollingerStudy(){
 const client=await pool.connect();
 try{
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const [count,data]=await Promise.all([
   client.query<CountRow>(COUNT_SQL),
   client.query<FrozenRow>(COMBINED_SQL)
  ]);
  const meta=count.rows[0];
  if(!meta)throw Error("SOURCE_COUNT_UNAVAILABLE");
  if(Number(meta.verified_base_volume)!==
     await (async()=>{
       const distinct=await client.query<{n:number}>(`
        SELECT COUNT(*)::int n FROM (
         SELECT DISTINCT detector_version,code,signal_time
         FROM public.bb_breakout_shadow_outcomes
         WHERE detector_version='BB_BREAKOUT_SHADOW_V1' AND horizon=1
        ) e`);
       return Number(distinct.rows[0]?.n??-1);
     })())throw Error("BASE_VOLUME_INCOMPLETE");
  const summary=evaluateCombinedResearch(data.rows,{
   baseOutcomes:meta.base_outcomes,expansionOutcomes:meta.expansion_outcomes,
   verifiedBaseVolume:meta.verified_base_volume,factors:meta.factors});
  await client.query("COMMIT");
  return summary;
 }catch(err){
  await client.query("ROLLBACK").catch(()=>undefined);
  throw err;
 }finally{client.release();}
}
