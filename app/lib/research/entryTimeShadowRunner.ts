import "server-only";
import pool from "@/app/lib/postgres";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {ENTRY_TIME_SHADOW_VERSION, jstParts, selectPriorDayCandidates, evaluateEntryTimes} from "./entryTimeShadow.mjs";
import {evaluateExitTimeStudy} from "./exitTimingStudy.mjs";

type SavedSignal = {code:string;name:string;score:number|string;price:number|string};
type FrozenSignal = {code:string;name:string;score:number;referencePrice:number;rank:number};
type Candle = {time:number;open:number|null;high:number|null;close:number|null;low:number|null};
const MAX_CODES=5;
const YAHOO_TIMEOUT_MS=8_000;

function previousTradingDate(today:string) {
  const t=Date.parse(today+"T00:00:00Z");
  for(let offset=1;offset<=7;offset++){
    const day=new Date(t-offset*86_400_000).toISOString().slice(0,10);
    if(isTseTradingDate(day)) return day;
  }
  throw Error("PREVIOUS_TRADING_DATE_UNRESOLVED");
}
function allowedStudyTime(now:Date) {
  const j=jstParts(now);
  let trading=false;
  try {trading=isTseTradingDate(j.date);}catch {return {ok:false,date:j.date,reason:"CALENDAR_UNAVAILABLE"};}
  if(!trading) return {ok:false,date:j.date,reason:"TSE_CLOSED"};
  if(j.minute<16*60+35||j.minute>=18*60) return {ok:false,date:j.date,reason:"OUTSIDE_AFTER_CLOSE_WINDOW"};
  return {ok:true,date:j.date,reason:"OK"};
}

async function yahooIntraday(code:string):Promise<Candle[]> {
  if(!/^[0-9]{4}$/.test(code)) throw Error("INVALID_CODE");
  const endpoint="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(code+".T")+"?range=5d&interval=5m";
  const res=await fetch(endpoint,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0"},
    signal:AbortSignal.timeout(YAHOO_TIMEOUT_MS)});
  if(!res.ok) throw Error("YAHOO_UNAVAILABLE");
  const json=await res.json();
  const result=json?.chart?.result?.[0];
  const times:number[]=result?.timestamp??[];
  const q=result?.indicators?.quote?.[0];
  if(!Array.isArray(times)||!q||times.length<20) throw Error("INVALID_YAHOO_BARS");
  return times.slice(-500).map((time,index,array)=>{
    const realIndex=times.length-array.length+index;
    const open=Number(q.open?.[realIndex]);
    const close=Number(q.close?.[realIndex]);
    const low=Number(q.low?.[realIndex]);
    const high=Number(q.high?.[realIndex]);
    return {time:Number(time),open:Number.isFinite(open)&&open>0?open:null,
      close:Number.isFinite(close)&&close>0?close:null,
      low:Number.isFinite(low)&&low>0?low:null,
      high:Number.isFinite(high)&&high>0?high:null};
  });
}

/** POST-CONFIRMED 16:45 JST only. One daily claim precedes all requests.
 * Archive is research-isolated; never calls scan, scores, orders or alerts.
 */
export async function runEntryTimeShadowDaily(now=new Date()) {
  const preflight=allowedStudyTime(now);
  if(!preflight.ok) return {success:true,skipped:true,date:preflight.date,reason:preflight.reason};
  const date=preflight.date;
  const priorDate=previousTradingDate(date);
  const {rows}=await pool.query<SavedSignal>(
    "SELECT code,name,score,price FROM public.daily_stock_results WHERE date=$1 AND score>=85 AND price>0 AND code ~ '^[0-9]{4}$' ORDER BY score DESC,code ASC LIMIT 5",
    [priorDate]
  );
  const cohort:FrozenSignal[]=selectPriorDayCandidates(rows);
  if(!cohort.length) return {success:true,skipped:true,date,priorDate,reason:"NO_FROZEN_PRIOR_DAY_SIGNALS"};
  // DB claim permanently caps requests to <=5 for this day, even if they fail.
  const claim=await pool.query<{trade_date:string}>(
    "INSERT INTO public.entry_time_shadow_runs (trade_date,prior_date,policy_version,cohort) VALUES ($1::date,$2::date,$3,$4::jsonb) ON CONFLICT (trade_date) DO NOTHING RETURNING trade_date::text",
    [date,priorDate,ENTRY_TIME_SHADOW_VERSION,JSON.stringify(cohort)]
  );
  if(!claim.rows.length) return {success:true,skipped:true,date,reason:"ALREADY_CLAIMED"};
  try {
    const results=await Promise.all(cohort.slice(0,MAX_CODES).map(async signal=>{
      try {
        const candles=await yahooIntraday(signal.code);
        const original=evaluateEntryTimes(date,signal,candles);
        // Optional additive shadow: same frozen cohort / same 5 market-data requests.
        // Any new evaluator error must not disrupt legacy 16:45 saved outcomes.
        try {
          const exitTimeStudy=evaluateExitTimeStudy(date,signal,candles);
          return {...original,exitTimeStudy};
        } catch (error) {
          console.warn("exit timing optional study unavailable",signal.code,error);
          return original;
        }
      }catch(e) {
        return {code:signal.code,name:signal.name,rank:signal.rank,
          priorScore:signal.score,priorReferencePrice:signal.referencePrice,
          date,closePrice:null,complete:false,entries:[],
          error:e instanceof Error?e.message:"YAHOO_UNKNOWN"};
      }
    }));
    const done=results.filter(x=>x.complete).length;
    const status=done===cohort.length?"COMPLETE":"PARTIAL";
    await pool.query(
      "UPDATE public.entry_time_shadow_runs SET results=$2::jsonb,status=$3,finished_at=now(),note=$4 WHERE trade_date=$1::date AND status='CLAIMED'",
      [date,JSON.stringify(results),status,done+"/"+cohort.length+" complete; no automatic retries"]
    );
    return {success:true,skipped:false,date,priorDate,status,sampled:done,requested:cohort.length};
  }catch(error){
    await pool.query(
      "UPDATE public.entry_time_shadow_runs SET status='FAILED',finished_at=now(),note=$2 WHERE trade_date=$1::date AND status='CLAIMED'",
      [date,error instanceof Error?error.message:"RESEARCH_ERROR"]
    ).catch(()=>undefined);
    return {success:false,skipped:false,date,status:"FAILED",error:"RESEARCH_ARCHIVE_UNAVAILABLE"};
  }
}
