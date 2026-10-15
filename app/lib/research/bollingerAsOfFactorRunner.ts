import "server-only";
import pool from "@/app/lib/postgres";
import {getForwardCandles} from "@/app/lib/emaForwardShadowStore";
import {resolveTargetTradeDate,isTseTradingDate,
 TSE_MARKET_CALENDAR_COVERAGE,TSE_MARKET_CALENDAR_VERSION} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {BB_BREAKOUT_BATCHES} from "./bollingerBreakoutBatches";
import {BB_EXPANSION_BATCHES} from "./bollingerExpansionUniverse";
import {validateCompletedArchive} from "./bollingerBreakoutQuality.mjs";
import {matchSavedAsOfFactors,FACTOR_VERSION} from "./bollingerAsOfFactorCore.mjs";
import {VERSION as BREAKOUT_VERSION} from "./bollingerBreakoutShadow.mjs";

const BASKETS=[...BB_BREAKOUT_BATCHES,...BB_EXPANSION_BATCHES] as readonly (readonly string[])[];
const FIRST_DATE="2026-01-01";
const stamp=t=>new Date(t*1000).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
function verifyBaskets(){
 const all=BASKETS.flat();
 if(BASKETS.length!==20||all.length!==100||new Set(all).size!==100||
  !BASKETS.every(a=>a.length===5&&a.every(c=>/^[0-9]{4}$/.test(c))))
  throw Error("BASKET_POLICY_INVALID");
}
function codesFor(batch:unknown){
 verifyBaskets();
 if(typeof batch!=="number"||!Number.isInteger(batch)||batch<0||batch>19)
  throw Error("INVALID_BATCH");
 return [...BASKETS[batch]];
}
function exchangeDates(start:string,end:string){
 if(start<TSE_MARKET_CALENDAR_COVERAGE.startDate||
    end>TSE_MARKET_CALENDAR_COVERAGE.endDate||start>end)
  throw Error("CALENDAR_UNAVAILABLE");
 const dates:string[]=[];
 let d=Date.parse(start+"T00:00:00Z"),last=Date.parse(end+"T00:00:00Z");
 for(let i=0;d<=last&&i<400;i++,d+=86400000){
  const day=new Date(d).toISOString().slice(0,10);
  if(isTseTradingDate(day))dates.push(day);
 }
 if(d<=last)throw Error("CALENDAR_CAP");
 return dates;
}
type Stored={
 code:string;signal_time:string;detector_version:string;horizon:number;
 group_key:string;signal_close:string;source_hash:string;
};
type StatRow={factor_name:string;group_key:string;factor_group:string;
 horizon:number;n:number;wins:number;mean_return:number;mean_adverse:number};
export async function getAsOfFactorProgress(){
 const [attempts,coverage,stats]=await Promise.all([
  pool.query<{batch_id:number;target_date:string;status:string;new_factors:number;note:string|null}>(`
   SELECT DISTINCT ON(batch_id) batch_id,target_date::text,status,new_factors,note
   FROM public.bb_asof_factor_attempts ORDER BY batch_id,target_date DESC`),
  pool.query<{factor_count:number;signal_count:number}>(`
   SELECT (SELECT COUNT(*)::int FROM public.bb_asof_factors) AS factor_count,
    ((SELECT COUNT(*) FROM public.bb_breakout_shadow_outcomes WHERE horizon=1)
    +(SELECT COUNT(*) FROM public.bb_breakout_expansion_outcomes WHERE horizon=1))::int
    AS signal_count`),
  pool.query<StatRow>(`
   WITH outcome AS (
    SELECT detector_version,code,signal_time,group_key,horizon,return_percent,max_adverse_percent
    FROM public.bb_breakout_shadow_outcomes
    UNION ALL
    SELECT detector_version,code,signal_time,group_key,horizon,return_percent,max_adverse_percent
    FROM public.bb_breakout_expansion_outcomes
   ), one_factor AS (
    SELECT f.detector_version,f.code,f.signal_time,k.name,k.grp
    FROM public.bb_asof_factors f
    CROSS JOIN LATERAL (
      VALUES('RSI'::text,f.rsi_group),
       ('TREND_10D'::text,f.trend_group),
       ('BREAKOUT_STRENGTH'::text,f.breakout_group)
    ) AS k(name,grp)
   )
   SELECT f.name AS factor_name,o.group_key,f.grp AS factor_group,
     o.horizon,COUNT(*)::int AS n,
     COUNT(*) FILTER(WHERE o.return_percent>0)::int AS wins,
     AVG(o.return_percent)::float AS mean_return,
     AVG(o.max_adverse_percent)::float AS mean_adverse
   FROM outcome o JOIN one_factor f ON f.code=o.code
    AND f.signal_time=o.signal_time
    AND f.detector_version=o.detector_version
   GROUP BY f.name,o.group_key,f.grp,o.horizon
   ORDER BY f.name,o.group_key,f.grp,o.horizon`)
 ]);
 return {version:FACTOR_VERSION,batches:BASKETS.map((codes,id)=>({id,codes})),
  attempts:attempts.rows,completeCount:attempts.rows.filter(a=>a.status==="COMPLETED").length,
  coverage:coverage.rows[0],stats:stats.rows.map(x=>{
   const n=Number(x.n);
   return {factor:x.factor_name,group:x.group_key,bucket:x.factor_group,horizon:Number(x.horizon),
    sampleCount:n,positiveRate:n>=30?Number(x.wins)/n:null,
    meanReturn:n>=30?Number(x.mean_return):null,
    meanAdverse:n>=30?Number(x.mean_adverse):null};
  })};
}
async function finish(batch:number,date:string,status:"REJECTED",note:string){
 await pool.query(`UPDATE public.bb_asof_factor_attempts
   SET status=$3,note=$4,finished_at=now()
   WHERE batch_id=$1 AND target_date=$2::date AND status='CLAIMED'`,
   [batch,date,status,note.slice(0,160)]);
}
export async function runAsOfFactorBatch(batch:number,now=new Date()){
 const codes=codesFor(batch);
 const target=resolveTargetTradeDate(now).targetTradeDate;
 const done=await pool.query(`SELECT 1 FROM public.bb_asof_factor_attempts
  WHERE batch_id=$1 AND status='COMPLETED' LIMIT 1`,[batch]);
 if(done.rowCount)return {status:"ALREADY_COMPLETED",batch,
  progress:await getAsOfFactorProgress()};
 const claim=await pool.query(`INSERT INTO public.bb_asof_factor_attempts
  (batch_id,target_date,codes,factor_version)
  VALUES($1,$2::date,$3::text[],$4)
  ON CONFLICT(batch_id,target_date) DO NOTHING RETURNING batch_id`,
  [batch,target,codes,FACTOR_VERSION]);
 if(!claim.rowCount)return {status:"ALREADY_CLAIMED",batch,
  progress:await getAsOfFactorProgress()};
 try{
  const sourceTable=batch<4?"bb_breakout_shadow_outcomes":"bb_breakout_expansion_outcomes";
  // Table names are constants selected from a binary branch, never supplied by a request.
  const stored=await pool.query<Stored>(`SELECT code,signal_time::text,detector_version,
     horizon,group_key,signal_close::text,source_hash
   FROM public.${sourceTable}
   WHERE code=ANY($1::text[]) AND horizon=1 AND detector_version=$2
   ORDER BY code,signal_time`,[codes,BREAKOUT_VERSION]);
  const fetched:Awaited<ReturnType<typeof getForwardCandles>>[]=[];
  for(let i=0;i<codes.length;i+=2){
   const results=await Promise.allSettled(codes.slice(i,i+2).map(getForwardCandles));
   if(results.some(r=>r.status!=="fulfilled"))throw Error("SOURCE_UNAVAILABLE");
   for(const r of results)if(r.status==="fulfilled")fetched.push(r.value);
  }
  const inputs=fetched.map((s,index)=>{
   if(s.code!==codes[index])throw Error("SOURCE_STOCK_MISMATCH");
   const candles=s.candles.filter(b=>{
    const day=stamp(b.time);return day>=FIRST_DATE&&day<=target;
   });
   if(candles.length<81||stamp(candles.at(-1)!.time)!==target)
    throw Error("LATEST_COMPLETED_DAY_UNAVAILABLE");
   const item={code:s.code,provider:"YAHOO_CHART",timeframe:"1D",candles,
    splitEvents:[...s.splitEvents].sort((a,b)=>a-b),
    expectedTradingDates:exchangeDates(stamp(candles[0].time),target),
    asOfCompletedJstDate:target};
   const q=validateCompletedArchive(item);
   if(!q.ok)throw Error("OHLC_QUALITY_FAILED:"+s.code+":"+q.reason);
   return item;
  });
  const matches=matchSavedAsOfFactors(inputs,stored.rows,TSE_MARKET_CALENDAR_VERSION);
  if(matches.length!==stored.rows.length)throw Error("MISSING_STORED_SIGNAL");
  const records=matches.map(f=>({
   detector_version:f.detector_version,code:f.code,signal_time:f.signal_time,
   original_source_hash:f.original_source_hash,factor_version:f.factor_version,
   rsi14:f.rsi14,trend10_percent:f.trend10Percent,
   breakout_strength_percent:f.breakoutStrengthPercent,
   rsi_group:f.rsiGroup,trend_group:f.trendGroup,breakout_group:f.breakoutGroup,
   original_scope:batch<4?"BASE20":"EXPANSION80",
   batch_id:batch,first_target_date:target
  }));
  const client=await pool.connect();
  let inserted=0;
  try{
   await client.query("BEGIN");
   const changed=await client.query(`
    WITH incoming AS(SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
      detector_version text,code text,signal_time bigint,
      original_source_hash text,rsi14 numeric,trend10_percent numeric,
      breakout_strength_percent numeric))
    SELECT 1 FROM public.bb_asof_factors f JOIN incoming i
    ON f.detector_version=i.detector_version AND f.code=i.code
    AND f.signal_time=i.signal_time
    WHERE f.original_source_hash<>i.original_source_hash
     OR f.rsi14 IS DISTINCT FROM i.rsi14
     OR f.trend10_percent IS DISTINCT FROM i.trend10_percent
     OR f.breakout_strength_percent IS DISTINCT FROM i.breakout_strength_percent
    LIMIT 1`,[JSON.stringify(records)]);
   if(changed.rowCount)throw Error("FROZEN_SOURCE_FACTORS_REVISED");
   if(records.length){
    const saved=await client.query(`INSERT INTO public.bb_asof_factors(
       detector_version,code,signal_time,original_source_hash,factor_version,
       rsi14,trend10_percent,breakout_strength_percent,rsi_group,trend_group,
       breakout_group,original_scope,batch_id,first_target_date)
     SELECT detector_version,code,signal_time,original_source_hash,factor_version,
       rsi14,trend10_percent,breakout_strength_percent,rsi_group,trend_group,
       breakout_group,original_scope,batch_id,first_target_date
     FROM jsonb_to_recordset($1::jsonb) AS x(
       detector_version text,code text,signal_time bigint,original_source_hash text,
       factor_version text,rsi14 numeric,trend10_percent numeric,
       breakout_strength_percent numeric,rsi_group text,trend_group text,
       breakout_group text,original_scope text,batch_id smallint,first_target_date date)
     ON CONFLICT(detector_version,code,signal_time) DO NOTHING`,[JSON.stringify(records)]);
    inserted=saved.rowCount??0;
   }
   await client.query(`UPDATE public.bb_asof_factor_attempts
     SET status='COMPLETED',new_factors=$3,note=$4,finished_at=now()
     WHERE batch_id=$1 AND target_date=$2::date AND status='CLAIMED'`,
     [batch,target,inserted,"FROZEN_1D_SOURCE_HASH_VERIFIED"]);
   await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}
  finally{client.release();}
  return {status:"COMPLETED",batch,targetDate:target,codes,
   savedFactors:inserted,verifiedSignals:matches.length,
   progress:await getAsOfFactorProgress()};
 }catch(err){
  const reason=err instanceof Error?err.message:"UNKNOWN";
  await finish(batch,target,"REJECTED",reason).catch(()=>undefined);
  return {status:"REJECTED",batch,targetDate:target,
   reason:reason.startsWith("SOURCE_HASH_REVISED")?"SOURCE_HASH_REVISED":
    reason==="SOURCE_UNAVAILABLE"?"SOURCE_UNAVAILABLE":"FACTOR_QUALITY_REJECTED",
   progress:await getAsOfFactorProgress()};
 }
}
