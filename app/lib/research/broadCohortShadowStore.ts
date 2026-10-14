import "server-only";
import pool from "@/app/lib/postgres";
import { resolveTargetTradeDate } from "@/app/lib/technicalObservation/tseMarketCalendar";
import { BROAD_SHADOW_VERSION, captureBroadCohort } from "./broadCohortShadow.mjs";

type PriorCandidate={code:string;name:string;score:string|number;price:string|number};
type CachedStock={code?:unknown;name?:unknown;score?:unknown;aiPower?:unknown;
  price?:unknown;currentPrice?:unknown;latestBarTimestamp?:unknown};

/** Appends a separate, bounded research snapshot after the existing 30-row
 * golden-zone & five-code captures. Reuses the same already-loaded wide scan:
 * no scan invocation, no Yahoo calls, no Cron, no model or trading mutation.
 */
export async function saveBroadCohortShadow(args:{
  now:Date;tradeDate:string;timeSlot:string;stocks:CachedStock[];
  snapshotSavedAt:string;
}){
  const prev=resolveTargetTradeDate(args.now);
  if(!prev.targetTradeDateReason.startsWith("PREVIOUS_TSE_TRADING_DAY"))
    return {skipped:"PREVIOUS_TSE_SESSION_UNAVAILABLE"};
  const priorDate=prev.targetTradeDate;
  if(priorDate>=args.tradeDate)return {skipped:"INVALID_PRIOR_DATE"};

  // Score threshold is frozen from the prior session and independent of
  // present-day movements. The same ordered top 30 will be selected at all
  // seven subsequent slots.
  const {rows}=await pool.query<PriorCandidate>(
    "SELECT code,name,score,price FROM public.daily_stock_results "+
    "WHERE date=$1 AND score>=85 AND price>0 AND code ~ '^[0-9]{4}$' "+
    "ORDER BY score DESC,code ASC LIMIT 30",
    [priorDate]
  );
  if(rows.length===0)return {skipped:"NO_PRIOR_COHORT"};
  const captured=captureBroadCohort({
    cohort:rows,stocks:args.stocks,tradeDate:args.tradeDate,
    priorDate,timeSlot:args.timeSlot,
    snapshotSavedAt:args.snapshotSavedAt,now:args.now
  });
  const result=await pool.query(
    "INSERT INTO public.broad_ai_research_snapshots "+
    "(trade_date,time_slot,prior_date,policy_version,expected_count,observed_count,"+
    "observations,missing,scan_snapshot_at) "+
    "VALUES ($1::date,$2,$3::date,$4,$5,$6,$7::jsonb,$8::jsonb,$9::timestamptz) "+
    "ON CONFLICT (trade_date,time_slot) DO NOTHING",
    [args.tradeDate,args.timeSlot,priorDate,BROAD_SHADOW_VERSION,
      captured.expected,captured.valid.length,JSON.stringify(captured.valid),
      JSON.stringify(captured.missing),args.snapshotSavedAt]
  );
  return {saved:result.rowCount??0,expected:captured.expected,
    recorded:captured.valid.length,excluded:captured.missing.length,
    policy:BROAD_SHADOW_VERSION};
}
