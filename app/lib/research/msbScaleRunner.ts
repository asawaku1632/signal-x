import "server-only";
import pool from "@/app/lib/postgres";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";
import { selectHorizontalAutoDailyStocks } from "./horizontalAutoPolicy";
import { getMsbAutoEnabled } from "./msbAutoSwitch";
import { chooseMsbUnseenStocks, MSB_SCALE_BATCH_SIZE, MSB_SCALE_MAX_EXTRA_BATCHES } from "./msbScalePolicy";
import { archiveClaimedMsbBatch } from "./msbAutoRunner";
import { fetchCohort } from "./shadowCandleYahoo";

export const MSB_SCALE_TIME_BUDGET_MS = 43_000; // 17s safety buffer in 60s Cron

type ScaleControl={enabled:boolean;extra_batches:number};
export type ScaleResult={
  status:"COMPLETED"|"PARTIAL"|"SKIPPED"|"FAILED";
  dateJst:string; batchesCompleted:number; stocksAdded:number;
  reason?:string; stoppedAtBatch?:number;
};

/** Absent/OFF means no extra Yahoo requests, ever. */
export async function getMsbScaleExtraBatchLimit():Promise<number>{
  const r=await pool.query<ScaleControl>(
    "SELECT enabled,extra_batches FROM public.msb_volume_scale_control WHERE id=true LIMIT 1"
  );
  const v=r.rows[0];
  return v?.enabled===true&&Number.isInteger(v.extra_batches)&&
    v.extra_batches>=0&&v.extra_batches<=MSB_SCALE_MAX_EXTRA_BATCHES ? v.extra_batches : 0;
}

/** Called only after the existing original five-candle study has completed.
 * Every extra batch is claimed BEFORE requesting Yahoo. A failure is recorded
 * without retry, and the next batch will not run that day. No notifications,
 * production AI, or any horizontal-learning writes.
 */
export async function runMsbScaleDaily(now:Date, invocationStartedMs:number):Promise<ScaleResult>{
  const preflight=selectHorizontalAutoDailyStocks({
    now,universe:ACTIVE_STOCKS.map(x=>String(x.code)),coveredCodes:new Set(),
  });
  const day=preflight.dateJst;
  const noop=(reason:string):ScaleResult=>({
    status:"SKIPPED",dateJst:day,batchesCompleted:0,stocksAdded:0,reason,
  });
  if(!preflight.ok)return noop(preflight.reason);
  if(!(await getMsbAutoEnabled()))return noop("MSB_AUTO_DISABLED");
  const maxExtra=await getMsbScaleExtraBatchLimit();
  if(maxExtra===0)return noop("SCALE_DISABLED");

  // Fail closed if the base five have not finished; no 50-stock run can
  // interfere with or mask a failed regular horizontal/MSB collection.
  const base=await pool.query<{status:string}>(
    "SELECT status FROM public.msb_volume_auto_daily_runs WHERE trade_date=$1::date LIMIT 1",[day]
  );
  if(base.rows[0]?.status!=="COMPLETED")return noop("BASE_FIVE_NOT_COMPLETED");

  // Covers manual archives, the original daily five, all previous attempts
  // including FAILED, and other scale batches; never reuse the same symbol.
  const covered=await pool.query<{code:string}>(
    "SELECT DISTINCT code FROM ("+
    "SELECT unnest(codes) AS code FROM public.msb_volume_research_runs "+
    "UNION ALL SELECT unnest(codes) AS code FROM public.msb_volume_auto_daily_runs "+
    "UNION ALL SELECT unnest(codes) AS code FROM public.msb_volume_scale_batches"+
    ") v"
  );
  const choices=chooseMsbUnseenStocks({
    universe:ACTIVE_STOCKS.map(x=>String(x.code)),
    covered:new Set(covered.rows.map(r=>r.code)),extraBatches:maxExtra,
  });
  if(!choices.length)return noop("NO_UNRESEARCHED_STOCKS");

  let batchesCompleted=0,stocksAdded=0;
  for(let index=0;index<maxExtra;index++){
    const batchNo=index+1;
    const codes=choices.slice(index*MSB_SCALE_BATCH_SIZE,batchNo*MSB_SCALE_BATCH_SIZE);
    if(!codes.length)break;
    if(Date.now()-invocationStartedMs>=MSB_SCALE_TIME_BUDGET_MS)
      return {status:"PARTIAL",dateJst:day,batchesCompleted,stocksAdded,
        reason:"TIME_BUDGET",stoppedAtBatch:batchNo};
    if(!(await getMsbAutoEnabled())||await getMsbScaleExtraBatchLimit()<batchNo)
      return {status:"PARTIAL",dateJst:day,batchesCompleted,stocksAdded,
        reason:"SWITCH_DISABLED",stoppedAtBatch:batchNo};

    const claim=await pool.query(
      "INSERT INTO public.msb_volume_scale_batches(trade_date,batch_no,codes) "+
      "VALUES($1::date,$2,$3::text[]) ON CONFLICT(trade_date,batch_no) DO NOTHING RETURNING batch_no",
      [day,batchNo,codes]
    );
    // Fail closed on repeated Cron calls. No second batch can silently run.
    if(!claim.rowCount)
      return {status:"PARTIAL",dateJst:day,batchesCompleted,stocksAdded,
        reason:"ALREADY_CLAIMED",stoppedAtBatch:batchNo};

    const loaded=await fetchCohort(codes); // ≤5 symbols; ≤3 concurrent requests
    const saved=await archiveClaimedMsbBatch(day,codes,loaded,batchNo);
    if(!saved.success)
      return {status:"FAILED",dateJst:day,batchesCompleted,stocksAdded,
        reason:saved.reason??"BATCH_SAVE_FAILED",stoppedAtBatch:batchNo};

    batchesCompleted++;
    stocksAdded+=codes.length;
  }
  return {status:"COMPLETED",dateJst:day,batchesCompleted,stocksAdded,
    reason:stocksAdded<maxExtra*MSB_SCALE_BATCH_SIZE?"UNIVERSE_EXHAUSTED":undefined};
}
