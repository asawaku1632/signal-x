import "server-only";
import pool from "@/app/lib/postgres";
import { getForwardCandles } from "@/app/lib/emaForwardShadowStore";
import { SUPPORT_REBOUND_RESEARCH_BASKET } from "./supportReboundUniverse";
import { REBOUND_AUTO_REQUEST_LIMIT_PER_DAY, REBOUND_AUTO_STOCKS_PER_BATCH,
  japanDate, reboundAutoPreflight, validReboundDailyInput,
  todayReboundCandidate, progressFrozenRebound } from "./supportReboundAutoCore";
import type { ReboundCandle } from "../supportReboundResearch";

type Loaded = {code:string;candles:ReboundCandle[];splitEvents:number[]};
type Result = {code:string;state:"DONE"|"FAILED"|"STALE";newSignal:number;note:string|null};
type DBSignal = {id:string;signal_time:string;signal_close:string;score_version:string;state:"PENDING"|"OPEN";entry_time:string|null;entry_price:string|null};
const MAX_PARALLEL=5;
const FETCH_REQUEST_LIMIT=50;
function jstDay(n:number){return japanDate(n);}
const reason=(e:unknown)=>e instanceof Error?e.message.slice(0,100):"UNEXPECTED_ERROR";

export async function runReboundAutoBatch(
  batch:0|1, now=new Date(),
  loader:(code:string)=>Promise<Loaded>=getForwardCandles,
){
  const preflight=reboundAutoPreflight(now);
  if(!preflight.ok)return {success:true,skipped:true,reason:preflight.reason,date:preflight.date};
  if(SUPPORT_REBOUND_RESEARCH_BASKET.length!==REBOUND_AUTO_REQUEST_LIMIT_PER_DAY)
    return {success:false,skipped:true,reason:"BASKET_SIZE_MISMATCH"};
  const control=await pool.query<{enabled:boolean}>(
    "SELECT enabled FROM public.rebound_forward_control WHERE singleton=1");
  if(control.rows.length!==1||control.rows[0].enabled!==true)
    return {success:true,skipped:true,reason:"FEATURE_DISABLED",date:preflight.date};
  const start=batch*REBOUND_AUTO_STOCKS_PER_BATCH;
  const codes=SUPPORT_REBOUND_RESEARCH_BASKET.slice(start,start+REBOUND_AUTO_STOCKS_PER_BATCH);
  if(codes.length!==FETCH_REQUEST_LIMIT)return {success:false,skipped:true,reason:"BATCH_SIZE_MISMATCH"};
  const claimed=await pool.query(
    "INSERT INTO public.rebound_forward_daily_batches(trade_date,batch) VALUES($1::date,$2) "+
    "ON CONFLICT(trade_date,batch) DO NOTHING RETURNING batch",
    [preflight.date,batch]);
  if(!claimed.rowCount)return {success:true,skipped:true,reason:"ALREADY_CLAIMED",date:preflight.date,batch};

  const results:Result[]=[];
  for(let i=0;i<codes.length;i+=MAX_PARALLEL){
    const group=await Promise.all(codes.slice(i,i+MAX_PARALLEL).map(async code: string):Promise<Result>=>{
      try{
        // At most one vendor request per code/day; no backoff/retry storm.
        const source=await loader(code);
        const candles=source.candles;
        const last=candles.at(-1);
        if(!validReboundDailyInput(candles)||!last||jstDay(last.time)!==preflight.date){
          await pool.query("INSERT INTO public.rebound_forward_stock_checks "+
            "(trade_date,batch,code,state,note,latest_bar_date) VALUES($1::date,$2,$3,'STALE','NO_SAME_DAY_CLOSED_BAR',$4::date) "+
            "ON CONFLICT(trade_date,code) DO NOTHING",
            [preflight.date,batch,code,last&&jstDay(last.time)!=="INVALID"?jstDay(last.time):null]);
          return {code,state:"STALE",newSignal:0,note:"NO_SAME_DAY_CLOSED_BAR"};
        }
        let newSignal=0;
        const client=await pool.connect();
        try{
          await client.query("BEGIN");
          const open=await client.query<DBSignal>(
            "SELECT id::text,signal_time::text,signal_close::text,score_version,state, "+
            "entry_time::text,entry_price::text FROM public.rebound_forward_signals "+
            "WHERE code=$1 AND state IN ('PENDING','OPEN') ORDER BY signal_time FOR UPDATE",
            [code]);
          for(const row of open.rows){
            const progress=progressFrozenRebound({
              id:Number(row.id),signalTime:Number(row.signal_time),
              signalClose:Number(row.signal_close),scoreVersion:row.score_version,
              state:row.state,entryTime:row.entry_time===null?null:Number(row.entry_time),
              entryPrice:row.entry_price===null?null:Number(row.entry_price),
            },candles,source.splitEvents);
            if(progress.state==="PENDING")continue;
            await client.query(
              "UPDATE public.rebound_forward_signals SET state=$2,reason=$3,entry_time=$4,entry_price=$5,"+
              "exit_time=$6,exit_price=$7,return_percent=$8,worst_intratrade_percent=$9,updated_at=now() "+
              "WHERE id=$1",[row.id,progress.state,progress.reason,
                progress.entryTime,progress.entryPrice,progress.exitTime,progress.exitPrice,
                progress.returnPercent,progress.worstIntratradePercent]);
          }
          // Only today's just-closed bar may create a new prospective signal.
          const candidate=todayReboundCandidate(candles,source.splitEvents,preflight.date);
          if(candidate){
            const saved=await client.query(
              "INSERT INTO public.rebound_forward_signals "+
              "(code,signal_time,signal_day,signal_close,score_version,score,band,features) "+
              "VALUES($1,$2,$3::date,$4,$5,$6,$7,$8::jsonb) "+
              "ON CONFLICT(code,signal_time) DO NOTHING RETURNING id",
              [code,candidate.signalTime,preflight.date,candidate.signalClose,
               candidate.scoreVersion,candidate.score,candidate.band,JSON.stringify(candidate.features)]);
            newSignal=saved.rowCount??0;
          }
          await client.query(
            "INSERT INTO public.rebound_forward_stock_checks "+
            "(trade_date,batch,code,state,latest_bar_date) VALUES($1::date,$2,$3,'DONE',$1::date) "+
            "ON CONFLICT(trade_date,code) DO NOTHING",
            [preflight.date,batch,code]);
          await client.query("COMMIT");
        }catch(error){await client.query("ROLLBACK");throw error}
        finally{client.release();}
        return {code,state:"DONE",newSignal,note:null};
      }catch(error){
        const note=reason(error);
        try{
          await pool.query("INSERT INTO public.rebound_forward_stock_checks "+
            "(trade_date,batch,code,state,note) VALUES($1::date,$2,$3,'FAILED',$4) "+
            "ON CONFLICT(trade_date,code) DO NOTHING",
            [preflight.date,batch,code,note]);
        }catch(logErr){console.error("rebound study failure ledger unavailable",logErr)}
        console.error("rebound study stock failed",code,note);
        return {code,state:"FAILED",newSignal:0,note};
      }
    }));
    results.push(...group);
  }
  const done=results.filter(x=>x.state==="DONE").length;
  const failed=results.length-done;
  const signals=results.reduce((sum,x)=>sum+x.newSignal,0);
  await pool.query("UPDATE public.rebound_forward_daily_batches SET state=$3,succeeded=$4,failed=$5,"+
    "new_signals=$6,finished_at=now() WHERE trade_date=$1::date AND batch=$2",
    [preflight.date,batch,failed?done?"PARTIAL":"FAILED":"DONE",done,failed,signals]);
  return {success:failed===0,skipped:false,date:preflight.date,batch,
    requested:codes.length,succeeded:done,failed,newSignals:signals,
    failures:results.filter(r=>r.state!=="DONE").map(r=>({code:r.code,state:r.state,note:r.note}))};
}
