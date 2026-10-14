import "server-only";
import pool from "@/app/lib/postgres";
import { resolveTargetTradeDate } from "@/app/lib/technicalObservation/tseMarketCalendar";
import { collectFixedStabilityObservations } from "./fixedCohortJudgment.mjs";

type DailyCandidate = {code:string;name:string;score:number|string;price:number|string};
type ScanStock = {code?:unknown;price?:unknown;currentPrice?:unknown;score?:unknown;
  aiPower?:unknown;latestBarTimestamp?:unknown};
type FixedRow={tradeDate:string;priorDate:string;timeSlot:string;code:string;name:string;
  priorScore:number;priorRank:number;score:number;price:number;quoteTimestamp:string;
  snapshotSavedAt:string};

/** An ancillary INSERT after Golden Zone's existing capture has succeeded.
 * It reuses the already-fetched cached scan; no Yahoo calls, no new Cron.
 * Errors are isolated: if research is unavailable, original captures still succeed.
 */
export async function saveFixedStabilityObservation(args:{
  now:Date;tradeDate:string;timeSlot:string;stocks:ScanStock[];snapshotSavedAt:string;
  outcomeDate:string;
}){
  // At all seven market observation slots (<=15:15 JST), the standard
  // JPX trading date resolver must unambiguously choose the PREVIOUS session.
  const resolved=resolveTargetTradeDate(args.now);
  if(!resolved.targetTradeDateReason.startsWith("PREVIOUS_TSE_TRADING_DAY"))
    return {skipped:"NOT_PREVIOUS_TRADE_DAY"};
  const priorDate=resolved.targetTradeDate;
  if(priorDate>=args.tradeDate)return {skipped:"INVALID_PRIOR_TRADE_DATE"};
  const {rows}=await pool.query<DailyCandidate>(
    "SELECT code,name,score,price FROM public.daily_stock_results WHERE date=$1 AND score>=85 AND price>0 AND code ~ '^[0-9]{4}$' ORDER BY score DESC,code ASC LIMIT 5",
    [priorDate]
  );
  if(!rows.length)return {skipped:"NO_PRIOR_DAY_CANDIDATES"};
  const collected=collectFixedStabilityObservations({
    cohort:rows,stocks:args.stocks,tradeDate:args.tradeDate,priorDate,
    timeSlot:args.timeSlot,snapshotSavedAt:args.snapshotSavedAt,now:args.now
  });
  const valid=collected.valid as FixedRow[];
  if(!valid.length)return {skipped:"NO_CURRENT_DAY_VALID_QUOTE",expected:collected.expected,
    rejected:collected.missing.length};
  const params:unknown[]=[];
  const placeholders=valid.map((row,i)=>{
    const k=i*12;
    params.push(row.tradeDate,row.timeSlot,row.code,row.name,row.priorDate,
      row.priorRank,row.priorScore,row.score,row.price,row.quoteTimestamp,
      row.snapshotSavedAt,args.outcomeDate);
    return "("+Array.from({length:12},(_,j)=>"$"+(k+j+1)).join(",")+")";
  });
  const inserted=await pool.query(
    "INSERT INTO public.ai_judgment_fixed_cohort_observations "+
    "(trade_date,time_slot,code,name,prior_date,prior_rank,prior_score,ai_power,"+
    "entry_price,quote_timestamp,snapshot_saved_at,outcome_date) VALUES "+
    placeholders.join(",")+" ON CONFLICT (trade_date,time_slot,code) DO NOTHING",
    params
  );
  return {saved:inserted.rowCount??0,valid:valid.length,
    expected:collected.expected,rejected:collected.missing.length};
}
