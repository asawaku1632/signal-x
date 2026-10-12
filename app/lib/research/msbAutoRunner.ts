import "server-only";
import { createHash } from "node:crypto";
import pool from "@/app/lib/postgres";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";
import { dateJst, fetchCohort, type LoadedStock } from "./shadowCandleYahoo";
import { selectHorizontalAutoDailyStocks } from "./horizontalAutoPolicy";
import { getMsbAutoEnabled } from "./msbAutoSwitch";
import { studyMsbMaSwing, SWING_SHADOW_VERSION } from "./msbMaSwing";
import { historicalVolumeRatio, VOLUME_SENSITIVITY_VERSION } from "./msbMaVolumeSensitivity";

export type MsbAutoStatus = {
  success:boolean; skipped:boolean; status:"COMPLETED"|"FAILED"|"SKIPPED";
  dateJst:string; reason?:string; codes?:string[]; archiveId?:string;
};
type Mode = "SHARED"|"SOLO";

export async function claimMsbDaily(date:string,codes:readonly string[],mode:Mode):Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || codes.length<1 || codes.length>5 ||
      new Set(codes).size!==codes.length || codes.some(c=>!/^\d{4}$/.test(c))) {
    throw new Error("INVALID_MSB_AUTO_BATCH");
  }
  const result=await pool.query(
    "INSERT INTO public.msb_volume_auto_daily_runs(trade_date,codes,mode) "+
    "VALUES($1::date,$2::text[],$3) ON CONFLICT(trade_date) DO NOTHING RETURNING trade_date",
    [date,codes,mode]
  );
  return !!result.rowCount;
}
async function markFailed(date:string,reason:"DATA_UNAVAILABLE"|"RUN_ERROR"){
  try {
    await pool.query(
      "UPDATE public.msb_volume_auto_daily_runs "+
      "SET status='FAILED',note=$2,finished_at=now() "+
      "WHERE trade_date=$1::date AND status='CLAIMED'",[date,reason]
    );
  }catch(e){ console.error("msb auto failed-state update unavailable",e); }
}

/** Must be invoked ONLY with a previously claimed trade date, from authenticated Cron.
 * Uses a single trusted, bounded batch already fetched by horizontal research, or
 * the SOLO 5-stock limit. All saved data is versioned retrospective research only.
 */
export async function archiveClaimedMsbBatch(
  date:string,codes:readonly string[],loaded:readonly LoadedStock[],
):Promise<MsbAutoStatus> {
  if (loaded.length!==codes.length ||
      loaded.some((s,i)=>s.code!==codes[i] || s.error || s.candles.length<60)) {
    await markFailed(date,"DATA_UNAVAILABLE");
    return {success:false,skipped:false,dateJst:date,status:"FAILED",reason:"DATA_UNAVAILABLE",codes:[...codes]};
  }
  try{
    const stocks=loaded.map(s=>({code:s.code,candles:s.candles}));
    const report=studyMsbMaSwing(stocks);
    if(report.invalidCodes.length||report.cohortCount!==codes.length) {
      await markFailed(date,"DATA_UNAVAILABLE");
      return {success:false,skipped:false,dateJst:date,status:"FAILED",reason:"INVALID_CANDLES",codes:[...codes]};
    }
    const fingerprint=stocks.map(({code,candles})=>({
      code,bars:candles.map(c=>[c.time,c.open,c.high,c.low,c.close,c.volume??null]),
    })).sort((a,b)=>a.code.localeCompare(b.code));
    const inputHash=createHash("sha256").update(JSON.stringify({
      detector:SWING_SHADOW_VERSION,volume:VOLUME_SENSITIVITY_VERSION,stocks:fingerprint,
    })).digest("hex");
    const times=stocks.flatMap(s=>s.candles.map(c=>c.time));
    const byCode=new Map(stocks.map(s=>[s.code,s.candles]));
    const entries=report.trades.map(t=>{
      const bars=byCode.get(t.code)!;
      return {
        ...t,breakoutRatio:t.orderBlock?historicalVolumeRatio(bars,t.orderBlock.breakIndex):null,
        retestRatio:t.orderBlock?historicalVolumeRatio(bars,t.signalIndex):null,
      };
    });
    const client=await pool.connect();
    let archiveId:string;
    try{
      await client.query("BEGIN");
      const saved=await client.query<{id:string}>(
        "INSERT INTO public.msb_volume_research_runs "+
        "(detector_version,volume_version,input_hash,codes,first_bar_date,last_bar_date,base_count,ob_count) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(input_hash) DO NOTHING RETURNING id::text",
        [SWING_SHADOW_VERSION,VOLUME_SENSITIVITY_VERSION,inputHash,[...codes].sort(),
         dateJst(Math.min(...times)),dateJst(Math.max(...times)),
         entries.length,entries.filter(t=>t.orderBlock!==null).length]
      );
      if(saved.rows[0]){
        archiveId=saved.rows[0].id;
        if(entries.length)await client.query(
          "INSERT INTO public.msb_volume_research_observations "+
          "(detector_version,volume_version,code,signal_time,entry_time,exit_time,"+
          "profit_yen_100,return_percent,volume_eligible,ob_eligible,breakout_ratio,retest_ratio,first_run_id) "+
          "SELECT $1,$2,t.code,t.signal_time,t.entry_time,t.exit_time,t.profit,t.ret,t.vol,t.ob,"+
          "t.breakout,t.retest,$3::uuid FROM "+
          "UNNEST($4::text[],$5::bigint[],$6::bigint[],$7::bigint[],$8::integer[],$9::numeric[],"+
          "$10::boolean[],$11::boolean[],$12::numeric[],$13::numeric[]) "+
          "AS t(code,signal_time,entry_time,exit_time,profit,ret,vol,ob,breakout,retest) "+
          "ON CONFLICT(detector_version,volume_version,code,signal_time) DO NOTHING",
          [SWING_SHADOW_VERSION,VOLUME_SENSITIVITY_VERSION,archiveId,
           entries.map(t=>t.code),entries.map(t=>t.signalTime),
           entries.map(t=>t.entryTime),entries.map(t=>t.exitTime),
           entries.map(t=>t.profitYen100),entries.map(t=>t.returnPercent),
           entries.map(t=>t.eligible.MA525_VOLUME),entries.map(t=>t.orderBlock!==null),
           entries.map(t=>t.breakoutRatio),entries.map(t=>t.retestRatio)]
        );
      }else{
        const old=await client.query<{id:string}>(
          "SELECT id::text FROM public.msb_volume_research_runs WHERE input_hash=$1 LIMIT 1",[inputHash]
        );
        if(!old.rows[0])throw new Error("MSB_ARCHIVE_DUPLICATE_UNREADABLE");
        archiveId=old.rows[0].id;
      }
      const completed=await client.query(
        "UPDATE public.msb_volume_auto_daily_runs SET status='COMPLETED',"+
        "archive_run_id=$2::uuid,note=$3,finished_at=now() "+
        "WHERE trade_date=$1::date AND status='CLAIMED' RETURNING trade_date",
        [date,archiveId,saved.rows[0]?"ARCHIVED":"DUPLICATE_INPUT"]
      );
      if(!completed.rowCount)throw new Error("MSB_DAILY_CLAIM_CHANGED");
      await client.query("COMMIT");
    }catch(err){
      await client.query("ROLLBACK").catch(()=>undefined);throw err;
    }finally{client.release();}
    return {success:true,skipped:false,dateJst:date,status:"COMPLETED",codes:[...codes],archiveId};
  }catch(err){
    console.error("msb auto archive failed",err);
    await markFailed(date,"RUN_ERROR");
    return {success:false,skipped:false,dateJst:date,status:"FAILED",reason:"RUN_ERROR",codes:[...codes]};
  }
}

/** Horizonal Cron already fetched these five; NEVER issue another Yahoo call. */
export async function runMsbAutoShared(
  loaded:readonly LoadedStock[],date:string,
):Promise<MsbAutoStatus>{
  if(!(await getMsbAutoEnabled()))return {success:true,skipped:true,dateJst:date,status:"SKIPPED",reason:"FEATURE_DISABLED"};
  const codes=loaded.map(s=>s.code);
  const claimed=await claimMsbDaily(date,codes,"SHARED");
  return claimed ? archiveClaimedMsbBatch(date,codes,loaded) :
    {success:true,skipped:true,dateJst:date,status:"SKIPPED",reason:"ALREADY_CLAIMED"};
}

/** When horizontal study is OFF/exhausted, this uses the SAME authenticated Cron,
 * never an additional schedule. Select up to 5 unique codes, claim BEFORE HTTP.
 */
export async function runMsbAutoSolo(now=new Date()):Promise<MsbAutoStatus>{
  if(!(await getMsbAutoEnabled()))return {success:true,skipped:true,dateJst:"",status:"SKIPPED",reason:"FEATURE_DISABLED"};
  const previous=await pool.query<{code:string}>(
    "SELECT DISTINCT code FROM ("+
    "SELECT unnest(codes) AS code FROM public.msb_volume_research_runs "+
    "UNION ALL SELECT unnest(codes) AS code FROM public.msb_volume_auto_daily_runs) v"
  );
  const decision=selectHorizontalAutoDailyStocks({
    now,universe:ACTIVE_STOCKS.map(s=>String(s.code)),
    coveredCodes:new Set(previous.rows.map(r=>r.code)),
  });
  if(!decision.ok)return {success:true,skipped:true,dateJst:decision.dateJst,status:"SKIPPED",reason:decision.reason};
  const claimed=await claimMsbDaily(decision.dateJst,decision.codes,"SOLO");
  if(!claimed)return {success:true,skipped:true,dateJst:decision.dateJst,status:"SKIPPED",reason:"ALREADY_CLAIMED"};
  const loaded=await fetchCohort(decision.codes);
  return archiveClaimedMsbBatch(decision.dateJst,decision.codes,loaded);
}
