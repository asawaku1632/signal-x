import "server-only";
import {createHash} from "node:crypto";
import pool from "@/app/lib/postgres";
import {getForwardCandles} from "@/app/lib/emaForwardShadowStore";
import {resolveTargetTradeDate,isTseTradingDate,
 TSE_MARKET_CALENDAR_COVERAGE,TSE_MARKET_CALENDAR_VERSION} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {studyCompletedArchiveCohort,studyCompletedArchiveStock} from "./bollingerBreakoutQuality.mjs";
import {BB_EXPANSION_BATCHES,BB_EXPANSION_POLICY,getExpansionBatch,verifyExpansionBaskets} from "./bollingerExpansionUniverse";
import {VERSION as BB_VERSION} from "./bollingerBreakoutShadow.mjs";

const FIRST_DATE="2026-01-01";
const MAX_DATE_ITERATIONS=400;
const jstDate=(t:number)=>new Date(t*1000).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
const round6=(n:number)=>Number(n.toFixed(6));
function marketDays(first:string,last:string){
 if(first<TSE_MARKET_CALENDAR_COVERAGE.startDate||
    last>TSE_MARKET_CALENDAR_COVERAGE.endDate||first>last)throw Error("JPX_CALENDAR_OUTSIDE_COVERAGE");
 let t=Date.parse(first+"T00:00:00Z");
 const end=Date.parse(last+"T00:00:00Z"),dates:string[]=[];
 for(let i=0;t<=end&&i<MAX_DATE_ITERATIONS;i++,t+=86400000){
   const day=new Date(t).toISOString().slice(0,10);
   if(isTseTradingDate(day))dates.push(day);
 }
 if(t<=end)throw Error("JPX_CALENDAR_CAP");
 return dates;
}
export async function bbExpansionProgress(){
 const [attempts,base,more,groups]=await Promise.all([
  pool.query<{batch_id:number;status:string;target_date:string;saved_outcomes:number;saved_signals:number;note:string|null}>(`
    SELECT DISTINCT ON (batch_id) batch_id,status,target_date::text,
      saved_outcomes,saved_signals,note
    FROM public.bb_breakout_expansion_attempts
    ORDER BY batch_id,target_date DESC`),
  pool.query<{signals:number;results:number;stocks:number}>(`
    SELECT COUNT(*)::int AS results,COUNT(DISTINCT (code,signal_time))::int AS signals,
    COUNT(DISTINCT code)::int AS stocks
    FROM public.bb_breakout_shadow_outcomes WHERE detector_version=$1`,[BB_VERSION]),
  pool.query<{signals:number;results:number;stocks:number}>(`
    SELECT COUNT(*)::int AS results,COUNT(DISTINCT (code,signal_time))::int AS signals,
    COUNT(DISTINCT code)::int AS stocks
    FROM public.bb_breakout_expansion_outcomes WHERE detector_version=$1`,[BB_VERSION]),
  pool.query<{group_key:string;volume_bucket:string;horizon:number;sample_count:number;
     positive_count:number;average_return:number;average_adverse:number}>(`
    WITH all_results AS (
      SELECT o.group_key,COALESCE(f.volume_bucket,'UNKNOWN') volume_bucket,
       o.horizon,o.return_percent,o.max_adverse_percent
      FROM public.bb_breakout_shadow_outcomes o
      LEFT JOIN public.bb_breakout_volume_factors f
        ON f.detector_version=o.detector_version
        AND f.code=o.code AND f.signal_time=o.signal_time
      WHERE o.detector_version=$1
      UNION ALL
      SELECT group_key,volume_bucket,horizon,return_percent,max_adverse_percent
      FROM public.bb_breakout_expansion_outcomes WHERE detector_version=$1
    )
    SELECT group_key,volume_bucket,horizon,COUNT(*)::int AS sample_count,
      COUNT(*) FILTER(WHERE return_percent>0)::int AS positive_count,
      AVG(return_percent)::float AS average_return,
      AVG(max_adverse_percent)::float AS average_adverse
    FROM all_results GROUP BY group_key,volume_bucket,horizon
    ORDER BY group_key,volume_bucket,horizon`,[BB_VERSION])
 ]);
 const rows=groups.rows.map(x=>{
  const n=Number(x.sample_count),wins=Number(x.positive_count);
  return {group:x.group_key,volumeBucket:x.volume_bucket,horizon:Number(x.horizon),
    sampleCount:n,positiveRate:n>=30?wins/n:null,
    averageReturn:n>=30?Number(x.average_return):null,
    averageAdverse:n>=30?Number(x.average_adverse):null};
 });
 const done=attempts.rows.filter(x=>x.status==="COMPLETE").length;
 return {policy:BB_EXPANSION_POLICY,batchCount:16,completedBatches:done,
   baskets:BB_EXPANSION_BATCHES.map((codes,index)=>({batch:4+index,codes})),
   codesTarget:100,expandedCodesWithEvents:Number(more.rows[0]?.stocks??0),
   base:{signals:Number(base.rows[0]?.signals??0),outcomes:Number(base.rows[0]?.results??0)},
   expansion:{signals:Number(more.rows[0]?.signals??0),outcomes:Number(more.rows[0]?.results??0)},
   attempts:attempts.rows,stats:rows};
}
async function finish(id:number,date:string,status:"REJECTED"|"FAILED",reason:string){
 await pool.query(`UPDATE public.bb_breakout_expansion_attempts
   SET status=$3,note=$4,finished_at=now() WHERE batch_id=$1
     AND target_date=$2::date AND status='CLAIMED'`,
   [id,date,status,reason.slice(0,170)]);
}
/** Owner-triggered only. One durable DB attempt per batch/trading date before
 * ANY provider traffic. Exactly 5 stocks, 2 concurrent, no automatic retry.
 */
export async function runBbExpansion(id:number,now=new Date()){
 if(process.env.VERCEL_ENV!=="production")throw Error("EXPANSION_NON_PRODUCTION_BLOCKED");
 if(!verifyExpansionBaskets())throw Error("UNIVERSE_NOT_FROZEN");
 const codes=[...getExpansionBatch(id)];
 const target=resolveTargetTradeDate(now).targetTradeDate;
 // A successfully finished group is frozen forever, even if another market day passes.
 const already=await pool.query(`SELECT 1 FROM public.bb_breakout_expansion_attempts
   WHERE batch_id=$1 AND status='COMPLETE' LIMIT 1`,[id]);
 if(already.rowCount)return {status:"ALREADY_COMPLETE",batch:id,targetDate:target,
   progress:await bbExpansionProgress()};
 const claim=await pool.query(`INSERT INTO public.bb_breakout_expansion_attempts
   (batch_id,target_date,codes,policy_version)
   VALUES($1,$2::date,$3::text[],$4)
   ON CONFLICT(batch_id,target_date) DO NOTHING RETURNING batch_id`,
   [id,target,codes,BB_EXPANSION_POLICY]);
 if(!claim.rowCount)return {status:"ALREADY_CLAIMED",batch:id,targetDate:target,
   progress:await bbExpansionProgress()};
 try{
  const loaded:Awaited<ReturnType<typeof getForwardCandles>>[]=[];
  for(let i=0;i<codes.length;i+=2){
   const chunk=await Promise.allSettled(codes.slice(i,i+2).map(getForwardCandles));
   if(chunk.some(x=>x.status==="rejected"))throw Error("PRICE_SOURCE_UNAVAILABLE");
   for(const x of chunk)if(x.status==="fulfilled")loaded.push(x.value);
  }
  const inputs=loaded.map((f,i)=>{
   if(f.code!==codes[i])throw Error("SOURCE_SYMBOL_MISMATCH");
   const candles=f.candles.filter(bar=>{
    const date=jstDate(bar.time);return date>=FIRST_DATE&&date<=target;
   });
   if(candles.length<81||jstDate(candles.at(-1)!.time)!==target)
     throw Error("INCOMPLETE_HISTORY_OR_TODAY_PRICE:"+f.code);
   return {code:f.code,provider:"YAHOO_CHART",timeframe:"1D",candles,
    splitEvents:[...f.splitEvents].sort((a,b)=>a-b),
    expectedTradingDates:marketDays(jstDate(candles[0].time),target),
    asOfCompletedJstDate:target};
  });
  const check=studyCompletedArchiveCohort(inputs);
  if(check.status!=="READY_FOR_SHADOW_COMPARISON")
    throw Error("FULL_BATCH_DATA_QUALITY_REJECTED:"+
      check.quality.filter((x:{ok:boolean})=>!x.ok).map(x=>
       String(x.code)+":"+String(x.reason??"INVALID_SOURCE")).join(";"));
  const rows=inputs.flatMap(item=>studyCompletedArchiveStock(item).records.flatMap(r=>
   ([1,3,5] as const).flatMap(h=>{
    const outcome=(r.horizons as Record<number,{status:string;entryPrice:number;
       exitPrice:number;returnPercent:number;maxAdversePercent:number}>)[h];
    if(outcome?.status!=="COMPLETE")return [];
    const t=Number(r.signal.signalIndex);
    if(!Number.isInteger(t)||t<80||t>=item.candles.length)
      throw Error("INVALID_SIGNAL_INDEX");
    const hash=createHash("sha256").update(JSON.stringify({
      version:BB_VERSION,calendar:TSE_MARKET_CALENDAR_VERSION,
      code:item.code,history:item.candles.slice(t-80,t+1),
      future:item.candles.slice(t+1,t+h+1)
    })).digest("hex");
    const raw=r.signal.volumeRatio;
    const ratio=typeof raw==="number"&&Number.isFinite(raw)&&raw>=0
      ?round6(raw):null;
    if(ratio!==null&&ratio>100000)throw Error("INVALID_VOLUME_RATIO");
    return [{
      detector_version:BB_VERSION,code:item.code,
      signal_time:Number(r.signal.signalTime),horizon:h,
      group_key:r.signal.group,signal_close:round6(r.signal.signalClose),
      entry_price:round6(outcome.entryPrice),exit_price:round6(outcome.exitPrice),
      return_percent:round6(outcome.returnPercent),
      max_adverse_percent:round6(outcome.maxAdversePercent),
      next_day_return_inside:h===1?r.nextDayReturnInside:null,
      volume_ratio:ratio,
      volume_bucket:ratio===null?"UNKNOWN":ratio>=1.3?"HIGH_1_3X":"BELOW_1_3X",
      source_hash:hash,calendar_version:TSE_MARKET_CALENDAR_VERSION,
      batch_id:id,first_target_date:target
    }];
   })));
  const client=await pool.connect();
  let added=0;
  try{
   await client.query("BEGIN");
   const checkOld=await client.query(`
     WITH incoming AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
       AS x(detector_version text,code text,signal_time bigint,horizon smallint,source_hash text))
     SELECT 1 FROM public.bb_breakout_expansion_outcomes e JOIN incoming i
       ON e.detector_version=i.detector_version AND e.code=i.code
       AND e.signal_time=i.signal_time AND e.horizon=i.horizon
     WHERE e.source_hash<>i.source_hash LIMIT 1`,[JSON.stringify(rows)]);
   if(checkOld.rowCount)throw Error("FROZEN_SOURCE_REVISED");
   const ins=await client.query(`INSERT INTO public.bb_breakout_expansion_outcomes
      (detector_version,code,signal_time,horizon,group_key,signal_close,
       entry_price,exit_price,return_percent,max_adverse_percent,
       next_day_return_inside,volume_ratio,volume_bucket,source_hash,
       calendar_version,batch_id,first_target_date)
     SELECT detector_version,code,signal_time,horizon,group_key,signal_close,
       entry_price,exit_price,return_percent,max_adverse_percent,
       next_day_return_inside,volume_ratio,volume_bucket,source_hash,
       calendar_version,batch_id,first_target_date
     FROM jsonb_to_recordset($1::jsonb) AS x (
       detector_version text,code text,signal_time bigint,horizon smallint,
       group_key text,signal_close numeric,entry_price numeric,exit_price numeric,
       return_percent numeric,max_adverse_percent numeric,next_day_return_inside boolean,
       volume_ratio numeric,volume_bucket text,source_hash text,calendar_version text,
       batch_id smallint,first_target_date date)
     ON CONFLICT(detector_version,code,signal_time,horizon) DO NOTHING`,[JSON.stringify(rows)]);
   added=ins.rowCount??0;
   const uniqueSignals=new Set(rows.filter(x=>x.horizon===1).map(x=>x.code+":"+x.signal_time)).size;
   const completed=await client.query(`UPDATE public.bb_breakout_expansion_attempts
     SET status='COMPLETE',saved_outcomes=$3,saved_signals=$4,
         finished_at=now(),note='FULL_QUALITY_SHADOW'
     WHERE batch_id=$1 AND target_date=$2::date AND status='CLAIMED'`,
     [id,target,added,uniqueSignals]);
   if(completed.rowCount!==1)throw Error("COMPLETE_UPDATE_COUNT_MISMATCH");
   await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}
  finally{client.release();}
  return {status:"COMPLETE",batch:id,targetDate:target,codes,newOutcomes:added,
    quality:check.quality,progress:await bbExpansionProgress()};
 }catch(err){
  const reason=err instanceof Error?err.message:"UNAVAILABLE";
  await finish(id,target,"REJECTED",reason).catch(()=>undefined);
  return {status:"REJECTED",batch:id,targetDate:target,
    reason:reason.startsWith("FULL_BATCH_DATA_QUALITY_REJECTED")?reason:
     reason==="PRICE_SOURCE_UNAVAILABLE"?reason:"EXPANSION_REJECTED",
    progress:await bbExpansionProgress()};
 }
}
