import "server-only";
import pool from "@/app/lib/postgres";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {nightMorningTradingDates} from "./nightMorningWatch.mjs";
import {
  MORNING_FINAL_POLICY,gatePhase,selectFrozenCohort,decideAtNineOhFive,
  compareClosingResults
} from "./morningFinalCheck.mjs";
import {auditYahooOpeningAsOf,OPENING_SOURCE_AUDIT_VERSION} from "./morningOpeningSourceEvidence.mjs";

type DbSignal={code:string;name:string;score:number|string;price:number|string};
type Frozen={code:string;name:string;score:number;referencePrice:number;rank:number};
type StoredRun={
  trade_date:string;prior_date:string;cohort:Frozen[];
  morning_observations:Record<string,unknown>[];
  morning_state:string;closing_state:string
};
type Bar={time:number;open:number|null;high:number|null;
  low:number|null;close:number|null;volume:number|null};
const YAHOO_TIMEOUT_MS=8000;
const MAX_CODES=5;

// Research metadata only. Never infer a trading halt from a failed quote feed.
function quoteFailureReason(error:unknown):string {
  const message=error instanceof Error?error.message:"";
  if(message==="MISSING_FIVE_MINUTE_CANDLES")return "MISSING_CANDLES";
  if(message==="OPENING_QUOTE_UNAVAILABLE")return "UPSTREAM_HTTP_ERROR";
  if(error instanceof Error&&error.name==="TimeoutError")return "UPSTREAM_TIMEOUT";
  return "UPSTREAM_FETCH_ERROR";
}

// Use only the raw 09:00 OHLCV and 09:05 OPEN if they were already
// returned in the contemporaneous 09:08 request. No retry or later backfill.
async function openingBars(code:string,tradeDate:string,requestedAt:Date) {
  if(!/^[0-9]{4}$/.test(code))throw Error("INVALID_CODE");
  const path="https://query1.finance.yahoo.com/v8/finance/chart/"+
    encodeURIComponent(code+".T")+"?range=1d&interval=5m";
  const response=await fetch(path,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0"},
    signal:AbortSignal.timeout(YAHOO_TIMEOUT_MS)});
  if(!response.ok)throw Error("OPENING_QUOTE_UNAVAILABLE");
  const payload=await response.json();
  const receivedAt=new Date();
  return auditYahooOpeningAsOf({payload,tradeDate,requestedAt,receivedAt});
}

export async function runMorningFinalCheck(phase:string,now=new Date()) {
  if(!["freeze","morning","closing"].includes(phase))throw Error("INVALID_PHASE");
  const gate=gatePhase(now,phase,isTseTradingDate);
  if(!gate.ok)return {success:true,skipped:gate.reason,date:gate.date,phase};
  const date=gate.date;
  if(phase==="freeze"){
    const dates=nightMorningTradingDates(now,isTseTradingDate);
    if(dates.sourceDate!==date)throw Error("FREEZE_DATE_INCONSISTENT");
    const {rows}=await pool.query<DbSignal>(
      "SELECT code,name,score,price FROM public.daily_stock_results "+
      "WHERE date=$1 AND score>=85 AND score<=100 AND price>0 "+
      "AND code ~ '^[0-9]{4}$' ORDER BY score DESC,code ASC LIMIT 5",
      [dates.sourceDate]);
    const cohort:Frozen[]=selectFrozenCohort(rows);
    if(!cohort.length)return {success:true,skipped:"NO_NIGHT_SIGNALS",date,phase};
    const saved=await pool.query(
      "INSERT INTO public.morning_final_check_runs "+
      "(trade_date,prior_date,policy_version,cohort) VALUES ($1::date,$2::date,$3,$4::jsonb) "+
      "ON CONFLICT (trade_date) DO NOTHING",
      [dates.tradeDate,dates.sourceDate,MORNING_FINAL_POLICY,JSON.stringify(cohort)]);
    return {success:true,phase,tradeDate:dates.tradeDate,priorDate:dates.sourceDate,
      frozen:!!saved.rowCount,candidates:cohort.length};
  }

  const {rows}=await pool.query<StoredRun>(
    "SELECT trade_date::text,prior_date::text,cohort,morning_observations,"+
    "morning_state,closing_state FROM public.morning_final_check_runs "+
    "WHERE trade_date=$1::date AND policy_version=$2",
    [date,MORNING_FINAL_POLICY]);
  const run=rows[0];
  if(!run)return {success:true,skipped:"NO_PREVIOUS_NIGHT_FREEZE",date,phase};
  if(!Array.isArray(run.cohort)||run.cohort.length<1||run.cohort.length>MAX_CODES)
    return {success:false,reason:"INVALID_FROZEN_COHORT",date,phase};

  if(phase==="morning"){
    const claim=await pool.query(
      "UPDATE public.morning_final_check_runs SET "+
      "morning_state='CLAIMED',morning_claimed_at=now() "+
      "WHERE trade_date=$1::date AND policy_version=$2 AND morning_state='PENDING' "+
      "RETURNING trade_date",
      [date,MORNING_FINAL_POLICY]);
    if(!claim.rowCount)return {success:true,skipped:"MORNING_ALREADY_CLAIMED",date,phase};
    // One irrevocable claim BEFORE network calls: at most 5 calls/day, no repeat or backfill.
    try {
      const snapshots=await Promise.all(run.cohort.slice(0,MAX_CODES).map(async c=>{
        const requestedAt=new Date();
        try {
          const {bars,evidence}=await openingBars(c.code,date,requestedAt);
          const observation=decideAtNineOhFive(c,bars,date,new Date(evidence.receivedAt??requestedAt));
          const usable=evidence.status==="AVAILABLE_AS_OF_RECEIPT"&&
            observation.label!=="UNAVAILABLE";
          return {...observation,quoteStatus:usable?"OBSERVED":"UNAVAILABLE",
            quoteReason:usable?null:(evidence.reason??"CLASSIFIER_REJECTED"),
            quoteEvidence:evidence,
            source:"YAHOO_FIVE_MINUTE",exchangeHaltVerified:false};
        }catch(error) {
          const receivedAt=new Date();
          const reason=quoteFailureReason(error);
          const unavailable=decideAtNineOhFive(c,[],date,receivedAt);
          return {...unavailable,quoteStatus:"UNAVAILABLE",quoteReason:reason,
            quoteEvidence:{
              version:OPENING_SOURCE_AUDIT_VERSION,source:"YAHOO_V8_CHART_5M",
              tradeDate:date,requestedAt:requestedAt.toISOString(),
              receivedAt:receivedAt.toISOString(),requiredSlots:["09:00","09:05"],
              observedSlots:[],missingSlots:["09:00","09:05"],
              status:"UNAVAILABLE",reason,executableFillVerified:false,
              officialSourceVerified:false,
            },
            source:"YAHOO_FIVE_MINUTE",exchangeHaltVerified:false};
        }
      }));
      const observed=snapshots.filter(s=>s.label!=="UNAVAILABLE").length;
      const capturedAt=new Date().toISOString();
      const status=observed===snapshots.length?"COMPLETE":"PARTIAL";
      await pool.query(
        "UPDATE public.morning_final_check_runs SET morning_state=$3,"+
        "morning_observations=$4::jsonb,morning_saved_at=$5::timestamptz,note=$6 "+
        "WHERE trade_date=$1::date AND policy_version=$2 AND morning_state='CLAIMED'",
        [date,MORNING_FINAL_POLICY,status,JSON.stringify(snapshots),capturedAt,
          observed+"/"+snapshots.length+" complete; no automatic retries"]);
      return {success:true,phase,date,status,observed,expected:snapshots.length};
    }catch(error){
      console.error("morning final capture failed",error);
      await pool.query("UPDATE public.morning_final_check_runs SET morning_state='FAILED',"+
        "note='MORNING_CAPTURE_ERROR' WHERE trade_date=$1::date AND morning_state='CLAIMED'",
        [date]).catch(()=>undefined);
      return {success:false,phase,date,reason:"MORNING_CAPTURE_FAILED"};
    }
  }

  if(run.morning_state!=="COMPLETE"&&run.morning_state!=="PARTIAL")
    return {success:true,skipped:"MORNING_NOT_RECORDED",date,phase};
  const closing=await pool.query<{
    trade_date:string;status:string;results:Record<string,unknown>[]
  }>(
    "SELECT trade_date::text,status,results FROM public.entry_time_shadow_runs "+
    "WHERE trade_date=$1::date AND policy_version='PRIOR_DAY_TOP5_CLOSE_V1' "+
    "AND status IN ('COMPLETE','PARTIAL') AND finished_at IS NOT NULL",
    [date]);
  if(!closing.rows.length)return {success:true,skipped:"INDEPENDENT_CLOSE_NOT_READY",date,phase};
  const claim=await pool.query(
    "UPDATE public.morning_final_check_runs SET closing_state='CLAIMED' "+
    "WHERE trade_date=$1::date AND policy_version=$2 AND closing_state='PENDING' RETURNING trade_date",
    [date,MORNING_FINAL_POLICY]);
  if(!claim.rowCount)return {success:true,skipped:"CLOSING_ALREADY_CLAIMED",date,phase};
  try {
    const results=compareClosingResults({
      tradeDate:date,cohort:run.cohort,morning:run.morning_observations,
      closingRun:closing.rows[0]});
    const matched=results.filter(r=>r.complete).length;
    const status=matched===run.cohort.length?"COMPLETE":"PARTIAL";
    await pool.query(
      "UPDATE public.morning_final_check_runs SET closing_state=$3,"+
      "closing_results=$4::jsonb,closing_saved_at=now() "+
      "WHERE trade_date=$1::date AND policy_version=$2 AND closing_state='CLAIMED'",
      [date,MORNING_FINAL_POLICY,status,JSON.stringify(results)]);
    return {success:true,phase,date,status,matched,expected:run.cohort.length};
  }catch(error){
    console.error("morning final close research failed",error);
    await pool.query("UPDATE public.morning_final_check_runs SET closing_state='FAILED' "+
      "WHERE trade_date=$1::date AND closing_state='CLAIMED'",[date]).catch(()=>undefined);
    return {success:false,phase,date,reason:"CLOSING_COMPARISON_FAILED"};
  }
}
