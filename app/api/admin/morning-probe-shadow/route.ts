import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import pool from "@/app/lib/postgres";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {MORNING_FINAL_POLICY} from "@/app/lib/research/morningFinalCheck.mjs";
import {isJpxStockCode} from "@/app/lib/research/jpxStockCode.mjs";
import {
  evaluateMorningProbe,probeSlotAt,summarizeMorningProbes,MORNING_PROBE_POLICY
} from "@/app/lib/research/morningProbeShadow.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store, max-age=0"};
const MAX_CODES=5;
type Candidate={code:string;name:string;score:number;referencePrice:number};
type Run={trade_date:string;prior_date:string;cohort:Candidate[];
  frozen_at:string};
type Candle={time:number;open:number|null;high:number|null;low:number|null;
  close:number|null;volume:number|null};

/**
 * EXPLICIT MANUAL GET ONLY. No schedule/cron, DB write, order, ranking update
 * or notification. Owner's one request costs at most 5 existing Yahoo HTTP
 * reads, and only on a trading day during 09:15..09:34 Japan time.
 */
export async function GET(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)return NextResponse.json({error:"NOT_FOUND"},{status:404,headers});
  const requestedAt=new Date();
  const slot=probeSlotAt(requestedAt);
  if(!slot.allowed||!isTseTradingDate(slot.date))
    return NextResponse.json({policy:MORNING_PROBE_POLICY,
      status:"OUTSIDE_MANUAL_PROBE_WINDOW",date:slot.date,slot:slot.slot,
      networkCalls:0}, {status:409,headers});
  // This research route reads only the immutable previous-night top-five.
  // A different full-budget snapshot must not be silently substituted.
  try {
    const result=await pool.query<Run>(
      "SELECT trade_date::text,prior_date::text,cohort,frozen_at::text "+
      "FROM public.morning_final_check_runs "+
      "WHERE trade_date=$1::date AND policy_version=$2 LIMIT 1",
      [slot.date,MORNING_FINAL_POLICY]);
    const run=result.rows[0];
    if(!run||!Array.isArray(run.cohort)||!run.cohort.length||
       run.cohort.length>MAX_CODES||!run.cohort.every(c=>isJpxStockCode(c.code))||
       !run.frozen_at||!run.prior_date||run.prior_date>=slot.date)
      return NextResponse.json({policy:MORNING_PROBE_POLICY,
        status:"VALID_FROZEN_COHORT_UNAVAILABLE",date:slot.date,
        networkCalls:0},{status:409,headers});

    const probes=await Promise.all(run.cohort.map(async candidate=>{
      const requestTime=new Date();
      // Race at 09:19:59 / 09:20:00: fail closed instead of relabeling
      // a response as having been known in the prior five-minute slot.
      if(probeSlotAt(requestTime).slot!==slot.slot)return {
        code:candidate.code,tradeDate:slot.date,probeSlot:slot.slot,
        status:"SLOT_ROLLOVER",networkStatus:"NOT_REQUESTED"};
      const url="https://query1.finance.yahoo.com/v8/finance/chart/"+
        encodeURIComponent(candidate.code+".T")+"?range=1d&interval=5m";
      try {
        const res=await fetch(url,{cache:"no-store",
          headers:{"User-Agent":"Mozilla/5.0"},
          signal:AbortSignal.timeout(8000)});
        const receivedAt=new Date();
        if(!res.ok)return {code:candidate.code,tradeDate:slot.date,
          probeSlot:slot.slot,status:"UPSTREAM_HTTP_ERROR",
          upstreamHttpStatus:res.status,receivedAt:receivedAt.toISOString()};
        const payload=await res.json();
        const result=payload?.chart?.result?.[0],q=result?.indicators?.quote?.[0];
        const times=result?.timestamp;
        const candles:Candle[]=Array.isArray(times)&&q?
          times.slice(0,120).map((t:unknown,i:number)=>({
            time:Number(t),
            open:typeof q.open?.[i]==="number"?q.open[i]:null,
            high:typeof q.high?.[i]==="number"?q.high[i]:null,
            low:typeof q.low?.[i]==="number"?q.low[i]:null,
            close:typeof q.close?.[i]==="number"?q.close[i]:null,
            volume:typeof q.volume?.[i]==="number"?q.volume[i]:null,
          })):[];
        return evaluateMorningProbe({
          tradeDate:slot.date,code:candidate.code,bars:candles,
          requestedAt:requestTime,receivedAt:new Date(),
          exchangeTimezone:result?.meta?.exchangeTimezoneName,
        });
      }catch(error){
        const reason=error instanceof Error&&
          ["TimeoutError","AbortError"].includes(error.name)?
          "UPSTREAM_TIMEOUT":"UPSTREAM_RESPONSE_UNAVAILABLE";
        return {code:candidate.code,tradeDate:slot.date,probeSlot:slot.slot,
          status:reason,receivedAt:new Date().toISOString()};
      }
    }));
    const finishedAt=new Date();
    const actualSlot=probeSlotAt(finishedAt);
    if(actualSlot.slot!==slot.slot||actualSlot.date!==slot.date)
      return NextResponse.json({policy:MORNING_PROBE_POLICY,
        status:"OVERALL_SLOT_ROLLOVER",networkCalls:probes.filter(p=>
          !("networkStatus" in p && p.networkStatus==="NOT_REQUESTED")).length,
        note:"All observations discarded from this slot, do not backdate"},
        {status:409,headers});
    return NextResponse.json({policy:MORNING_PROBE_POLICY,
      status:"REFERENCE_RESEARCH_ONLY",date:slot.date,slot:slot.slot,
      networkCalls:probes.filter(p=>!("networkStatus" in p && p.networkStatus==="NOT_REQUESTED")).length,
      probes,coverage:summarizeMorningProbes(probes),
      warning:"NOT_A_LIVE_BUY_SIGNAL_AND_NOT_A_FILLABLE_5M_OPEN"},
      {headers});
  }catch(error){
    console.error("owner manual morning feed availability research error",error);
    return NextResponse.json({policy:MORNING_PROBE_POLICY,
      status:"RESEARCH_READ_UNAVAILABLE",networkCalls:0},
      {status:503,headers});
  }
}
