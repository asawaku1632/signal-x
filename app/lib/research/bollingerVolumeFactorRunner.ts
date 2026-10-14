import "server-only";
import pool from "@/app/lib/postgres";
import {getForwardCandles} from "@/app/lib/emaForwardShadowStore";
import {resolveTargetTradeDate,isTseTradingDate,TSE_MARKET_CALENDAR_COVERAGE,
 TSE_MARKET_CALENDAR_VERSION} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {chooseBbBreakoutBatch,type BbBatchId} from "./bollingerBreakoutBatches";
import {studyCompletedArchiveCohort} from "./bollingerBreakoutQuality.mjs";
import {matchArchivedVolumeFactors,VOLUME_FACTOR_VERSION} from "./bollingerVolumeFactors.mjs";
import {VERSION as BB_VERSION} from "./bollingerBreakoutShadow.mjs";

type SavedOneDay={code:string;signal_time:string;horizon:number;
  detector_version:string;group_key:string;signal_close:string;source_hash:string};
type SummaryRow={group_key:string;volume_bucket:string;horizon:number|string;
  n:number|string;winners:number|string;mean_return:number|null;
  mean_adverse:number|null};
const dateJst=(t:number)=>new Date(t*1000).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
function tradingDates(first:string,last:string){
  if(first<TSE_MARKET_CALENDAR_COVERAGE.startDate||
     last>TSE_MARKET_CALENDAR_COVERAGE.endDate||first>last)throw Error("CALENDAR_OUT_OF_RANGE");
  const dates:string[]=[];
  let ts=Date.parse(first+"T00:00:00Z");
  const end=Date.parse(last+"T00:00:00Z");
  for(let n=0;ts<=end&&n<400;n++,ts+=86400000){
    const iso=new Date(ts).toISOString().slice(0,10);
    if(isTseTradingDate(iso))dates.push(iso);
  }
  if(ts<=end)throw Error("CALENDAR_LIMIT");
  return dates;
}
const FIRST_DATE="2026-01-01";
async function finish(batch:BbBatchId,target:string,status:"COMPLETE"|"REJECTED"|"FAILED",
  count:number,note:string){
  await pool.query(`UPDATE public.bb_breakout_volume_attempts
    SET status=$3,saved_count=$4,note=$5,finished_at=now()
    WHERE batch_id=$1 AND target_date=$2::date AND status='CLAIMED'`,
    [batch,target,status,count,note.slice(0,170)]);
}
export async function volumeFactorProgress(){
  const [summary, attempts, coverage]=await Promise.all([
    pool.query<SummaryRow>(`SELECT o.group_key,f.volume_bucket,o.horizon,
       COUNT(*)::int n,COUNT(*) FILTER(WHERE o.return_percent>0)::int winners,
       AVG(o.return_percent)::float mean_return,AVG(o.max_adverse_percent)::float mean_adverse
       FROM public.bb_breakout_shadow_outcomes o
       JOIN public.bb_breakout_volume_factors f
         ON o.detector_version=f.detector_version AND o.code=f.code
         AND o.signal_time=f.signal_time
       JOIN public.bb_breakout_shadow_outcomes frozen_one_day
         ON frozen_one_day.detector_version=f.detector_version
         AND frozen_one_day.code=f.code AND frozen_one_day.signal_time=f.signal_time
         AND frozen_one_day.horizon=1
         AND frozen_one_day.source_hash=f.original_source_hash
       WHERE o.detector_version=$1 GROUP BY o.group_key,f.volume_bucket,o.horizon
       ORDER BY o.group_key,f.volume_bucket,o.horizon`,[BB_VERSION]),
    pool.query(`SELECT batch_id,target_date::text,status,saved_count
      FROM public.bb_breakout_volume_attempts ORDER BY target_date DESC,batch_id LIMIT 28`),
    pool.query(`SELECT (SELECT COUNT(*)::int FROM public.bb_breakout_volume_factors) AS observed_events,
       (SELECT COUNT(*)::int FROM public.bb_breakout_shadow_outcomes WHERE horizon=1 AND detector_version=$1)
       AS eligible_events`,[BB_VERSION])
  ]);
  const statistics=summary.rows.map(r=>{
    const n=Number(r.n),wins=Number(r.winners);
    return {group:r.group_key,volumeBucket:r.volume_bucket,horizon:Number(r.horizon),
      n,eligible:n>=30,
      positiveRate:n>=30?wins/n:null,
      averageReturn:n>=30?Number(r.mean_return):null,
      averageAdverse:n>=30?Number(r.mean_adverse):null};
  });
  return {statistics,attempts:attempts.rows,coverage:coverage.rows[0]};
}
/** Historical-factor backfill: max 5 Yahoo requests, max 2 concurrent, one
 * permanent claim per batch/completed session, zero scheduled activity.
 */
export async function runVolumeFactorBatch(batch:BbBatchId,now=new Date()){
  const codes=[...chooseBbBreakoutBatch(batch)];
  const target=resolveTargetTradeDate(now).targetTradeDate;
  const claim=await pool.query(`INSERT INTO public.bb_breakout_volume_attempts
    (batch_id,target_date,codes,version) VALUES($1,$2::date,$3::text[],$4)
    ON CONFLICT(batch_id,target_date) DO NOTHING RETURNING batch_id`,
    [batch,target,codes,VOLUME_FACTOR_VERSION]);
  if(!claim.rowCount)return {status:"ALREADY_CLAIMED",batch,targetDate:target,
    progress:await volumeFactorProgress()};
  try{
    const original=await pool.query<SavedOneDay>(`SELECT code,signal_time::text,
        horizon,detector_version,group_key,signal_close::text,source_hash
        FROM public.bb_breakout_shadow_outcomes
        WHERE code=ANY($1::text[]) AND detector_version=$2 AND horizon=1
        ORDER BY code,signal_time`,[codes,BB_VERSION]);
    if(!original.rowCount)throw Error("NO_ARCHIVED_SIGNALS");
    const loaded:Awaited<ReturnType<typeof getForwardCandles>>[]=[];
    for(let index=0;index<codes.length;index+=2){
      const check=await Promise.allSettled(codes.slice(index,index+2).map(code=>getForwardCandles(code)));
      if(check.some(r=>r.status!=="fulfilled"))throw Error("PRICE_SOURCE_UNAVAILABLE");
      for(const item of check){
        if(item.status==="fulfilled")loaded.push(item.value);
      }
    }
    const inputs=loaded.map((data,i)=>{
      if(data.code!==codes[i])throw Error("WRONG_PROVIDER_SYMBOL");
      const candles=data.candles.filter(b=>{
        const date=dateJst(b.time);return date>=FIRST_DATE&&date<=target;
      });
      if(candles.length<81||dateJst(candles[candles.length-1].time)!==target)
        throw Error("COMPLETED_BAR_UNAVAILABLE:"+data.code);
      return {code:data.code,provider:"YAHOO_CHART",timeframe:"1D",
        candles,splitEvents:[...data.splitEvents].sort((a,b)=>a-b),
        expectedTradingDates:tradingDates(dateJst(candles[0].time),target),
        asOfCompletedJstDate:target};
    });
    const quality=studyCompletedArchiveCohort(inputs);
    if(quality.status!=="READY_FOR_SHADOW_COMPARISON")
      throw Error("FULL_COHORT_QUALITY_REJECTED");
    const factors=matchArchivedVolumeFactors(inputs,original.rows,TSE_MARKET_CALENDAR_VERSION);
    let inserted=0;
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const conflicts=await client.query(`WITH incoming AS
        (SELECT * FROM jsonb_to_recordset($1::jsonb)
         AS x(code text,signal_time bigint,original_source_hash text,
              volume_ratio numeric,volume_bucket text))
        SELECT 1 FROM public.bb_breakout_volume_factors saved JOIN incoming i
        ON saved.code=i.code AND saved.signal_time=i.signal_time
        AND saved.detector_version=$2
        WHERE saved.original_source_hash<>i.original_source_hash OR
          saved.volume_bucket<>i.volume_bucket OR
          saved.volume_ratio IS DISTINCT FROM i.volume_ratio
        LIMIT 1`,[JSON.stringify(factors),BB_VERSION]);
      if(conflicts.rowCount)throw Error("FROZEN_VOLUME_REVISION");
      const records=factors.map(x=>({...x,detector_version:BB_VERSION,
        metric_version:VOLUME_FACTOR_VERSION,horizon:1,
        batch_id:batch,first_target_date:target}));
      const saved=await client.query(`INSERT INTO public.bb_breakout_volume_factors
       (detector_version,code,signal_time,horizon,original_source_hash,
        volume_ratio,volume_bucket,metric_version,batch_id,first_target_date)
       SELECT detector_version,code,signal_time,horizon,original_source_hash,
        volume_ratio,volume_bucket,metric_version,batch_id,first_target_date
       FROM jsonb_to_recordset($1::jsonb)
       AS x(detector_version text,code text,signal_time bigint,horizon smallint,
        original_source_hash text,volume_ratio numeric,volume_bucket text,
        metric_version text,batch_id smallint,first_target_date date)
       ON CONFLICT(detector_version,code,signal_time) DO NOTHING`,[JSON.stringify(records)]);
      inserted=saved.rowCount??0;
      await client.query(`UPDATE public.bb_breakout_volume_attempts
         SET status='COMPLETE',saved_count=$3,finished_at=now(),
           note='EXACT_ORIGINAL_SOURCE_HASH_VERIFIED'
         WHERE batch_id=$1 AND target_date=$2::date AND status='CLAIMED'`,
         [batch,target,inserted]);
      await client.query("COMMIT");
    }catch(e){await client.query("ROLLBACK");throw e;}
    finally{client.release();}
    return {status:"COMPLETE",batch,targetDate:target,verified:factors.length,
      inserted,progress:await volumeFactorProgress()};
  }catch(err){
    const reason=err instanceof Error?err.message:"RESEARCH_UNAVAILABLE";
    await finish(batch,target,"REJECTED",0,reason).catch(()=>undefined);
    return {status:"REJECTED",batch,targetDate:target,
      reason:reason.startsWith("ARCHIVED_SOURCE_REVISED")?"ARCHIVED_SOURCE_REVISED":
        reason==="PRICE_SOURCE_UNAVAILABLE"?"PRICE_SOURCE_UNAVAILABLE":
        "FACTOR_VERIFICATION_UNAVAILABLE",
      progress:await volumeFactorProgress()};
  }
}
