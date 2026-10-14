import "server-only";
import {createHash} from "node:crypto";
import pool from "@/app/lib/postgres";
import {getForwardCandles} from "@/app/lib/emaForwardShadowStore";
import {resolveTargetTradeDate,isTseTradingDate,TSE_MARKET_CALENDAR_COVERAGE,
  TSE_MARKET_CALENDAR_VERSION} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {chooseBbBreakoutBatch,verifyBbBasket,BB_BATCH_POLICY,type BbBatchId} from "./bollingerBreakoutBatches";
import {studyCompletedArchiveCohort,studyCompletedArchiveStock} from "./bollingerBreakoutQuality.mjs";
import {VERSION as BB_VERSION} from "./bollingerBreakoutShadow.mjs";

const FROM_DATE="2026-01-01";
const MAX_TRADING_CALENDAR_DAYS=400;
const dateJst=(time:number)=>new Date(time*1000).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
const fixed6=(n:number)=>Number(n.toFixed(6));

function expectedDates(from:string,to:string):string[]{
  if(from<TSE_MARKET_CALENDAR_COVERAGE.startDate ||
     to>TSE_MARKET_CALENDAR_COVERAGE.endDate || from>to) throw Error("CALENDAR_COVERAGE");
  const values:string[]=[];
  let t=Date.parse(from+"T00:00:00Z");
  const end=Date.parse(to+"T00:00:00Z");
  for(let n=0;t<=end&&n<MAX_TRADING_CALENDAR_DAYS;n++,t+=86400000){
    const date=new Date(t).toISOString().slice(0,10);
    if(isTseTradingDate(date))values.push(date);
  }
  if(t<=end)throw Error("CALENDAR_CAP");
  return values;
}
type ReadRow={group_key:string;horizon:number|string;samples:number|string;
  wins:number|string;average_return:number|string;average_adverse:number|string;
  falsebreak_eligible:number|string;falsebreak_count:number|string};
type AttemptRow={batch_id:number;target_date:string;status:string;new_outcomes:number};
export async function getBollingerBatchProgress(){
  const [results,attempts]=await Promise.all([
    pool.query<ReadRow>(`SELECT group_key,horizon,COUNT(*)::int AS samples,
        COUNT(*) FILTER (WHERE return_percent>0)::int AS wins,
        AVG(return_percent)::float AS average_return,
        AVG(max_adverse_percent)::float AS average_adverse,
        COUNT(*) FILTER (WHERE horizon=1 AND next_day_return_inside IS NOT NULL)::int AS falsebreak_eligible,
        COUNT(*) FILTER (WHERE horizon=1 AND next_day_return_inside IS TRUE)::int AS falsebreak_count
      FROM public.bb_breakout_shadow_outcomes
      WHERE detector_version=$1
      GROUP BY group_key,horizon ORDER BY group_key,horizon`,[BB_VERSION]),
    pool.query<AttemptRow>(`SELECT batch_id,target_date::text,status,new_outcomes
      FROM public.bb_breakout_shadow_batch_attempts ORDER BY target_date DESC,batch_id ASC LIMIT 28`),
  ]);
  const stats=Object.fromEntries(["SQUEEZE_UP_BREAKOUT","OTHER_UP_BREAKOUT"].map(group=>
    [group,{horizons:Object.fromEntries([1,3,5].map(h=>{
      const r=results.rows.find(x=>x.group_key===group&&Number(x.horizon)===h);
      const n=Number(r?.samples??0);
      const wins=Number(r?.wins??0);
      const fbN=Number(r?.falsebreak_eligible??0);
      return [String(h),{sampleCount:n,status:n>=30?"READY":"INSUFFICIENT_SAMPLE",
        positiveRate:n>=30?wins/n:null,
        meanReturnPercent:n>=30?Number(r?.average_return):null,
        meanMaxAdversePercent:n>=30?Number(r?.average_adverse):null,
        nextDayReturnInsideRate:h===1&&fbN>=30?Number(r?.falsebreak_count??0)/fbN:null}];
    }))}]));
  return {stats,attempts:attempts.rows};
}
async function finishAttempt(batch:BbBatchId,date:string,status:"COMPLETED"|"DATA_REJECTED"|"FAILED",
  count:number,note:string){
  await pool.query(`UPDATE public.bb_breakout_shadow_batch_attempts
    SET status=$3,new_outcomes=$4,note=$5,finished_at=now()
    WHERE batch_id=$1 AND target_date=$2::date AND status='CLAIMED'`,
    [batch,date,status,count,note.slice(0,160)]);
}
/** An explicit owner action. One permanent target-date claim per batch comes
 * BEFORE any provider request. At most 5 calls, <=2 concurrent, NEVER retried.
 * Only isolated research tables are written.
 */
export async function runBollingerBatch(batch:BbBatchId,now=new Date()){
  if(!verifyBbBasket()) throw Error("BASKET_POLICY_INVALID");
  const codes=[...chooseBbBreakoutBatch(batch)];
  const target=resolveTargetTradeDate(now).targetTradeDate;
  const claim=await pool.query(`INSERT INTO public.bb_breakout_shadow_batch_attempts
     (batch_id,target_date,codes,policy_version)
     VALUES ($1,$2::date,$3::text[],$4)
     ON CONFLICT (batch_id,target_date) DO NOTHING RETURNING batch_id`,
     [batch,target,codes,BB_BATCH_POLICY]);
  if(!claim.rowCount)return {
    status:"ALREADY_CLAIMED",batch,targetDate:target,codes,
    progress:await getBollingerBatchProgress()
  };
  try{
    const fetched:Awaited<ReturnType<typeof getForwardCandles>>[]=[];
    for(let start=0;start<codes.length;start+=2){
      const settled=await Promise.allSettled(codes.slice(start,start+2).map(getForwardCandles));
      if(settled.some(x=>x.status==="rejected")){
        await finishAttempt(batch,target,"DATA_REJECTED",0,"PRICE_SOURCE_UNAVAILABLE");
        return {status:"DATA_REJECTED",batch,targetDate:target,codes,
          reason:"PRICE_SOURCE_UNAVAILABLE",progress:await getBollingerBatchProgress()};
      }
      fetched.push(...settled.map(x=>(x as PromiseFulfilledResult<Awaited<ReturnType<typeof getForwardCandles>>>).value));
    }
    const inputs=fetched.map((source,i)=>{
      if(source.code!==codes[i])throw Error("SOURCE_CODE_MISMATCH");
      const candles=source.candles.filter(c=>dateJst(c.time)>=FROM_DATE&&dateJst(c.time)<=target);
      if(candles.length<81||dateJst(candles.at(-1)!.time)!==target)
        throw Error("MISSING_COMPLETED_DAILY_BARS");
      return {code:source.code,provider:"YAHOO_CHART",timeframe:"1D",
        candles,expectedTradingDates:expectedDates(dateJst(candles[0].time),target),
        asOfCompletedJstDate:target,splitEvents:[...source.splitEvents].sort((a,b)=>a-b)};
    });
    const report=studyCompletedArchiveCohort(inputs);
    if(report.status!=="READY_FOR_SHADOW_COMPARISON"){
      await finishAttempt(batch,target,"DATA_REJECTED",0,
        report.quality.filter((x:{ok:boolean})=>!x.ok).map((x:{code:string;reason:string})=>x.code+":"+x.reason).join(";"));
      return {status:"DATA_REJECTED",batch,targetDate:target,codes,
        quality:report.quality,progress:await getBollingerBatchProgress()};
    }
    const rows=inputs.flatMap(item=>studyCompletedArchiveStock(item).records.flatMap(r=>
      ([1,3,5] as const).flatMap(h=>{
        const result=r.horizons[h];
        if(result?.status!=="COMPLETE")return [];
        const t=r.signal.signalIndex;
        const fingerprint=createHash("sha256").update(JSON.stringify({
          version:BB_VERSION,calendar:TSE_MARKET_CALENDAR_VERSION,
          code:item.code,history:item.candles.slice(t-80,t+1),
          future:item.candles.slice(t+1,t+h+1)
        })).digest("hex");
        return [{
          detector_version:BB_VERSION,code:item.code,signal_time:r.signal.signalTime,
          horizon:h,group_key:r.signal.group,
          signal_close:fixed6(r.signal.signalClose),
          entry_price:fixed6(result.entryPrice),
          exit_price:fixed6(result.exitPrice),
          return_percent:fixed6(result.returnPercent),
          max_adverse_percent:fixed6(result.maxAdversePercent),
          next_day_return_inside:h===1?r.nextDayReturnInside:null,
          source_hash:fingerprint,calendar_version:TSE_MARKET_CALENDAR_VERSION,
          batch_id:batch,first_target_date:target
        }];
      })));
    const client=await pool.connect();
    let inserted=0;
    try{
      await client.query("BEGIN");
      // Freeze the first graded result; later price revisions trigger fail-closed review.
      const conflicts=await client.query<{code:string;signal_time:string;horizon:number}>(`
        WITH incoming AS (
          SELECT * FROM jsonb_to_recordset($1::jsonb) AS x (
            detector_version text,code text,signal_time bigint,horizon smallint,source_hash text)
        )
        SELECT prior.code,prior.signal_time,prior.horizon
        FROM public.bb_breakout_shadow_outcomes prior JOIN incoming i
        ON prior.detector_version=i.detector_version AND prior.code=i.code
        AND prior.signal_time=i.signal_time AND prior.horizon=i.horizon
        WHERE prior.source_hash<>i.source_hash
        LIMIT 1`,[JSON.stringify(rows)]);
      if(conflicts.rowCount)throw Error("FROZEN_PRICE_SOURCE_REVISION");
      const saved=await client.query(`
        INSERT INTO public.bb_breakout_shadow_outcomes
          (detector_version,code,signal_time,horizon,group_key,signal_close,
           entry_price,exit_price,return_percent,max_adverse_percent,
           next_day_return_inside,source_hash,calendar_version,batch_id,first_target_date)
        SELECT detector_version,code,signal_time,horizon,group_key,signal_close,
           entry_price,exit_price,return_percent,max_adverse_percent,
           next_day_return_inside,source_hash,calendar_version,batch_id,first_target_date
        FROM jsonb_to_recordset($1::jsonb) AS x (
          detector_version text,code text,signal_time bigint,horizon smallint,
          group_key text,signal_close numeric,entry_price numeric,exit_price numeric,
          return_percent numeric,max_adverse_percent numeric,
          next_day_return_inside boolean,source_hash text,
          calendar_version text,batch_id smallint,first_target_date date)
        ON CONFLICT (detector_version,code,signal_time,horizon) DO NOTHING`,
        [JSON.stringify(rows)]);
      inserted=saved.rowCount??0;
      await client.query(`UPDATE public.bb_breakout_shadow_batch_attempts
        SET status='COMPLETED',new_outcomes=$3,finished_at=now(),note=$4
        WHERE batch_id=$1 AND target_date=$2::date AND status='CLAIMED'`,
        [batch,target,inserted,"COMPLETE_QUALITY; FROZEN_RETROSPECTIVE"]);
      await client.query("COMMIT");
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
    return {status:"COMPLETED",batch,targetDate:target,codes,
      quality:report.quality,newOutcomes:inserted,
      progress:await getBollingerBatchProgress()};
  }catch(err){
    const reason=err instanceof Error?err.message:"STUDY_FAILED";
    await finishAttempt(batch,target,"FAILED",0,reason).catch(()=>undefined);
    return {status:"FAILED",batch,targetDate:target,codes,
      reason:reason==="FROZEN_PRICE_SOURCE_REVISION"?reason:"RESEARCH_BATCH_UNAVAILABLE",
      progress:await getBollingerBatchProgress()};
  }
}
