import "server-only";
import pool from "@/app/lib/postgres";
import {isTseTradingDate,resolveTseTradingDatesAfter} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {nightMorningTradingDates} from "./nightMorningWatch.mjs";
import {
  WEAK_REBOUND_VERSION,WEAK_REBOUND_LIMIT,WEAK_REBOUND_HORIZONS,
  chooseWeakCohort,phaseGate,evaluateWeakEntry
} from "./weakAiRebound.mjs";

type DbSignal={code:string;name:string;score:string|number|null;price:string|number|null};
type Frozen={code:string;name:string;score:number;referencePrice:number;bucket:string;rank:number};
type Run={entry_date:string;source_date:string;cohort:Frozen[]};
type Bar={time:number;open:number|null;close:number|null;low:number|null;high:number|null};
const TIMEOUT_MS=8000;
const positive=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)&&n>0;

function quote(value:unknown):number|null{
  if(value==null||value==="")return null;
  const n=Number(value);
  return positive(n)?n:null;
}
/** Five *maximum* daily Yahoo 5m fetches, no retries, no paid API. */
async function yahooBars(code:string):Promise<Bar[]>{
  if(!/^[0-9]{4}$/.test(code))throw Error("INVALID_SYMBOL");
  const url="https://query1.finance.yahoo.com/v8/finance/chart/"+
    encodeURIComponent(code+".T")+"?range=5d&interval=5m";
  const response=await fetch(url,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0"},
    signal:AbortSignal.timeout(TIMEOUT_MS)});
  if(!response.ok)throw Error("INTRADAY_UNAVAILABLE");
  const json=await response.json();
  const data=json?.chart?.result?.[0],times:number[]=data?.timestamp??[];
  const q=data?.indicators?.quote?.[0];
  if(!Array.isArray(times)||!q||times.length<20)throw Error("NO_VALID_BARS");
  return times.slice(-500).map((timestamp,i,array)=>{
    const j=times.length-array.length+i;
    return {time:Number(timestamp),open:quote(q.open?.[j]),close:quote(q.close?.[j]),
      high:quote(q.high?.[j]),low:quote(q.low?.[j])};
  });
}
export async function runWeakReboundResearch(phase:string,now=new Date()){
  if(!["freeze","entry","outcomes"].includes(phase))throw Error("UNKNOWN_PHASE");
  const gate=phaseGate(now,phase,isTseTradingDate);
  if(!gate.ok)return {success:true,phase,date:gate.date,skipped:gate.reason};
  const date=gate.date;
  if(phase==="freeze"){
    const trading=nightMorningTradingDates(now,isTseTradingDate);
    if(trading.sourceDate!==date)throw Error("SOURCE_DATE_MISMATCH");
    const scan=await pool.query<DbSignal>(
      "SELECT code,name,score,price FROM public.daily_stock_results "+
      "WHERE date=$1 ORDER BY code LIMIT 1301",[date]);
    let cohort:Frozen[];
    try{cohort=chooseWeakCohort(scan.rows,date);}
    catch(error){
      console.warn("weak rebound nightly scan invalid",error);
      return {success:true,phase,date,skipped:"UNIVERSE_COVERAGE_INSUFFICIENT"};
    }
    if(!cohort.length)return {success:true,phase,date,skipped:"NO_WEAK_AI_COHORT"};
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const created=await client.query(
        "INSERT INTO public.weak_ai_rebound_runs(entry_date,source_date,rule_version,cohort) "+
        "VALUES($1::date,$2::date,$3,$4::jsonb) ON CONFLICT(entry_date) DO NOTHING "+
        "RETURNING entry_date",
        [trading.tradeDate,date,WEAK_REBOUND_VERSION,JSON.stringify(cohort)]);
      if(!created.rowCount){
        await client.query("COMMIT");
        return {success:true,phase,date,skipped:"ALREADY_FROZEN"};
      }
      for(const stock of cohort){
        await client.query(
          "INSERT INTO public.weak_ai_rebound_positions "+
          "(entry_date,source_date,code,name,rank,ai_power,ai_bucket,prior_price) "+
          "VALUES($1::date,$2::date,$3,$4,$5,$6,$7,$8)",
          [trading.tradeDate,date,stock.code,stock.name,stock.rank,
            stock.score,stock.bucket,stock.referencePrice]);
      }
      await client.query("COMMIT");
      return {success:true,phase,date,entryDate:trading.tradeDate,frozen:cohort.length};
    }catch(error){
      await client.query("ROLLBACK").catch(()=>undefined);
      throw error;
    }finally{client.release();}
  }

  if(phase==="entry"){
    // DB claim is irrevocable and precedes external data calls.
    const claimed=await pool.query<Run>(
      "UPDATE public.weak_ai_rebound_runs SET entry_state='CLAIMED',"+
      "entry_claimed_at=now() WHERE entry_date=$1::date AND rule_version=$2 "+
      "AND entry_state='PENDING' RETURNING entry_date::text,source_date::text,cohort",
      [date,WEAK_REBOUND_VERSION]);
    if(!claimed.rows.length)return {success:true,phase,date,skipped:"NOT_FROZEN_OR_ALREADY_CLAIMED"};
    const run=claimed.rows[0];
    if(!Array.isArray(run.cohort)||run.cohort.length<1||run.cohort.length>WEAK_REBOUND_LIMIT)
      return {success:false,phase,date,reason:"INVALID_COHORT"};
    try{
      const results=await Promise.all(run.cohort.map(async stock=>{
        try{return evaluateWeakEntry(date,stock,await yahooBars(stock.code));}
        catch(error){
          console.warn("weak rebound individual quote unavailable",stock.code,error);
          return evaluateWeakEntry(date,stock,[]);
        }
      }));
      const client=await pool.connect();
      try{
        await client.query("BEGIN");
        for(const result of results){
          await client.query(
            "UPDATE public.weak_ai_rebound_positions SET "+
            "entry_status=$3,entry_price=$4,close_price=$5,same_day_return=$6,"+
            "max_adverse_pct=$7,max_favorable_pct=$8,gap_pct=$9,"+
            "open5_move_pct=$10,open5_range_pct=$11,entry_reason=$12,"+
            "entry_saved_at=now(),updated_at=now() "+
            "WHERE entry_date=$1::date AND code=$2 AND entry_status='PENDING'",
            [date,result.code,result.status,result.entryPrice,result.closePrice,
              result.sameDayReturn,result.maxAdversePct,result.maxFavorablePct,
              result.gapPct,result.open5MovePct,result.open5RangePct,result.reason]);
        }
        const n=results.filter(r=>r.status==="COMPLETE").length;
        await client.query(
          "UPDATE public.weak_ai_rebound_runs SET entry_state=$2,"+
          "entry_finished_at=now(),note=$3 WHERE entry_date=$1::date AND entry_state='CLAIMED'",
          [date,n===results.length?"COMPLETE":"PARTIAL",n+"/"+results.length+" complete"]);
        await client.query("COMMIT");
        return {success:true,phase,date,complete:n,requested:results.length};
      }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}
      finally{client.release();}
    }catch(error){
      console.error("weak reversal archive unavailable",error);
      await pool.query("UPDATE public.weak_ai_rebound_runs "+
        "SET entry_state='FAILED',note='ARCHIVE_WRITE_FAILED' "+
        "WHERE entry_date=$1::date AND entry_state='CLAIMED'",[date]).catch(()=>undefined);
      return {success:false,phase,date,reason:"ENTRY_ARCHIVE_FAILED"};
    }
  }

  // 17:35 JST: only exact JPX trading dates and archived daily prices.
  // No price API, no false same-day availability, missing dates remain NULL.
  const pending=await pool.query<{entry_date:string}>(
    "SELECT DISTINCT entry_date::text AS entry_date FROM public.weak_ai_rebound_positions "+
    "WHERE entry_date<$1::date AND entry_date>=($1::date-INTERVAL '100 days') "+
    "AND entry_status='COMPLETE' AND outcome_10d_date IS NULL "+
    "ORDER BY entry_date LIMIT 90",[date]);
  const targetsByHorizon=new Map<number,{entryDate:string;priceDate:string}[]>(
    WEAK_REBOUND_HORIZONS.map((d:number)=>[d,[]]));
  for(const item of pending.rows){
    let sessions:string[];
    try{sessions=resolveTseTradingDatesAfter(item.entry_date,10,{maxLookaheadDays:45});}
    catch{continue;}
    for(const days of WEAK_REBOUND_HORIZONS){
      const target=sessions[days-1];
      if(target<=date)targetsByHorizon.get(days)?.push({entryDate:item.entry_date,priceDate:target});
    }
  }
  const updates:Record<number,number>={1:0,3:0,5:0,10:0};
  for(const days of WEAK_REBOUND_HORIZONS){
    const targets=targetsByHorizon.get(days)??[];
    if(!targets.length)continue;
    const values:unknown[]=[];
    const sqlValues=targets.map((t,i)=>{
      values.push(t.entryDate,t.priceDate);
      return "($"+(i*2+1)+"::date,$"+(i*2+2)+"::text)";
    }).join(",");
    const updated=await pool.query(
      "WITH targets(entry_date,price_date) AS (VALUES "+sqlValues+") "+
      "UPDATE public.weak_ai_rebound_positions AS p SET "+
      "outcome_"+days+"d_date=targets.price_date::date,"+
      "return_"+days+"d=ROUND((100.0*(future.price-p.entry_price)/p.entry_price)::numeric,4),"+
      "updated_at=now() "+
      "FROM targets,public.daily_stock_results AS future "+
      "WHERE p.entry_date=targets.entry_date AND future.code=p.code "+
      "AND future.date=targets.price_date AND future.price>0 "+
      "AND p.entry_price IS NOT NULL AND p.outcome_"+days+"d_date IS NULL",
      values);
    updates[days]=updated.rowCount??0;
  }
  return {success:true,phase,date,pendingDates:pending.rows.length,updates};
}
