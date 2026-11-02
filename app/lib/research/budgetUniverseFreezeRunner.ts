import "server-only";
import pool from "@/app/lib/postgres";
import {getFallbackTotalStockList} from "@/app/lib/learning/scanEngine";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {nightMorningTradingDates} from "./nightMorningWatch.mjs";
import {gatePhase} from "./morningFinalCheck.mjs";
import {freezeBudgetUniverse,BUDGET_UNIVERSE_POLICY,MAX_DAILY_ROWS}
  from "./budgetUniverseFreeze.mjs";

type SavedSignal={
  code:string;name:string;score:number|string|null;price:number|string|null;
  snapshotDate:string;savedAt:Date|string;
};
/** Separate research-only opt-in path, not a Vercel cron and not called on GET.
 * At most one insert per actual trade date. Never updates an old snapshot.
 */
export async function captureBudgetUniverseShadow(now=new Date()){
  if(process.env.BUDGET_UNIVERSE_SHADOW_WRITE_ENABLED!=="true")
    return {success:false,reason:"SHADOW_CAPTURE_DISABLED"};
  const gate=gatePhase(now,"freeze",isTseTradingDate);
  if(!gate.ok)return {success:false,reason:gate.reason};
  const dates=nightMorningTradingDates(now,isTseTradingDate);
  if(dates.sourceDate!==gate.date)return {success:false,reason:"SOURCE_DATE_MISMATCH"};
  const existing=await pool.query(
    "SELECT snapshot_hash FROM public.budget_night_shadow_runs "+
    "WHERE trade_date=$1::date",[dates.tradeDate]);
  if(existing.rows.length)return {success:true,stored:false,reason:"ALREADY_FROZEN"};

  const result=await pool.query<SavedSignal>(
    "SELECT code,name,score,price,date::text AS \"snapshotDate\",created_at AS \"savedAt\" "+
    "FROM public.daily_stock_results WHERE date=$1 "+
    "AND created_at<=$2::timestamptz ORDER BY code ASC LIMIT $3",
    [dates.sourceDate,now.toISOString(),MAX_DAILY_ROWS+1]);
  const raw=result.rows.map(row=>({
    ...row,
    savedAt:row.savedAt instanceof Date?row.savedAt.toISOString():String(row.savedAt),
  }));
  const freeze=freezeBudgetUniverse({
    rows:raw,sourceDate:dates.sourceDate,tradeDate:dates.tradeDate,
    frozenAt:now.toISOString(),expectedUniverseCount:getFallbackTotalStockList(),
  });
  const saved=await pool.query(
    "INSERT INTO public.budget_night_shadow_runs "+
    "(trade_date,prior_date,policy_version,frozen_at,snapshot_hash,snapshot) "+
    "VALUES ($1::date,$2::date,$3,$4::timestamptz,$5,$6::jsonb) "+
    "ON CONFLICT (trade_date) DO NOTHING RETURNING snapshot_hash",
    [dates.tradeDate,dates.sourceDate,BUDGET_UNIVERSE_POLICY,
      now.toISOString(),freeze.sha256,JSON.stringify(freeze)]);
  return {success:true,stored:!!saved.rowCount,reason:saved.rowCount?"FROZEN":"ALREADY_FROZEN",
    tradeDate:dates.tradeDate,priorDate:dates.sourceDate,
    seen:freeze.observedUniverseCount,eligible:freeze.cohort.length,
    budgets:freeze.budgets.map(b=>({budgetYen:b.budgetYen,count:b.codes.length})),
    snapshotHash:freeze.sha256};
}
