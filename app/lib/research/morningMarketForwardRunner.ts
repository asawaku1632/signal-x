import "server-only";
import pool from "@/app/lib/postgres";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {EXTERNAL_MARKET_SYMBOLS} from "./morningExternalContext.mjs";
import {
  MARKET_FORWARD_POLICY,preopenGate,parsePreopenQuote
} from "./morningMarketForward.mjs";

type Quote={price:number;changePct:number;quoteDate:string;
  sourceTimestamp:string;state:"REFERENCE"|"STALE"};
type Entry={key:string;symbol:string;zone:string;label:string};
const TIMEOUT=7_000;

async function fetchReference(entry:Entry,now:Date):Promise<Quote|null>{
  try{
    const endpoint="https://query1.finance.yahoo.com/v8/finance/chart/"+
      encodeURIComponent(entry.symbol)+"?range=10d&interval=1d";
    const response=await fetch(endpoint,{cache:"no-store",
      headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(TIMEOUT)});
    if(!response.ok)return null;
    return parsePreopenQuote(await response.json(),entry.zone,now);
  }catch{return null;}
}

/** Once-per-day independent snapshot of data seen BEFORE the Japanese market opens.
 * No retrospective fills or implicit retries. PTS is explicitly unconnected.
 */
export async function captureMorningMarketForward(now=new Date()){
  const gate=preopenGate(now,isTseTradingDate);
  if(!gate.ok)return {success:true,skipped:gate.reason,date:gate.date};
  const date=gate.date;
  const prior=await pool.query(
    "SELECT trade_date FROM public.morning_final_check_runs "+
    "WHERE trade_date=$1::date AND policy_version='FROZEN_NIGHT_0905_CHECK_V1' "+
    "AND frozen_at <= $2::timestamptz AND jsonb_array_length(cohort)>0 LIMIT 1",
    [date,now.toISOString()]);
  if(!prior.rowCount)return {success:true,skipped:"NO_PREVIOUS_NIGHT_FREEZE",date};
  const claimed=await pool.query(
    "INSERT INTO public.morning_market_forward_runs "+
    "(trade_date,policy_version,state,claimed_at,pts_status) "+
    "VALUES ($1::date,$2,'CLAIMED',$3::timestamptz,'UNAVAILABLE') "+
    "ON CONFLICT (trade_date) DO NOTHING RETURNING trade_date",
    [date,MARKET_FORWARD_POLICY,now.toISOString()]);
  if(!claimed.rowCount)return {success:true,skipped:"ALREADY_CAPTURED_OR_CLAIMED",date};
  try{
    const market=await Promise.all(EXTERNAL_MARKET_SYMBOLS.map(async e=>{
      const data=await fetchReference(e as Entry,now);
      return [e.key,data??{state:"UNAVAILABLE",price:null,changePct:null,
        quoteDate:null,sourceTimestamp:null}] as const;
    }));
    const quotes=Object.fromEntries(market);
    const available=Object.values(quotes).filter(
      (q:any)=>q.state==="REFERENCE").length;
    const state=available===EXTERNAL_MARKET_SYMBOLS.length?"COMPLETE":"PARTIAL";
    await pool.query(
      "UPDATE public.morning_market_forward_runs "+
      "SET state=$3,quotes=$4::jsonb,captured_at=$5::timestamptz, "+
      "source='Yahoo Finance daily chart',pts_status='UNAVAILABLE' "+
      "WHERE trade_date=$1::date AND policy_version=$2 AND state='CLAIMED'",
      [date,MARKET_FORWARD_POLICY,state,JSON.stringify(quotes),new Date().toISOString()]);
    return {success:true,date,state,available,total:market.length,pts:"UNAVAILABLE"};
  }catch(error){
    console.error("[morning-market-forward] independent snapshot failed",error);
    await pool.query(
      "UPDATE public.morning_market_forward_runs "+
      "SET state='FAILED',note='MARKET_CONTEXT_CAPTURE_ERROR' "+
      "WHERE trade_date=$1::date AND state='CLAIMED'",[date]).catch(()=>undefined);
    return {success:false,date,reason:"CAPTURE_FAILED"};
  }
}
