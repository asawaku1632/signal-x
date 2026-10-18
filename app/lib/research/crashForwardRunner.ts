import "server-only";
import { createHash } from "node:crypto";
import pool from "@/app/lib/postgres";
import { getCrashMarketReferences } from "@/app/lib/research/crashStrengthMarketReferenceRunner";
import {
  captureFrozenCrash,evaluateFrozenCandidates,jstClock,selectSessions,
  CRASH_FORWARD_VERSION,
} from "./crashForwardCore.mjs";

const addOneDay=(date:string)=>new Date(Date.parse(date+"T00:00:00Z")+86400000).toISOString().slice(0,10);
type SavedPrice={date:string;code:string;name:string;price:number|string|null};
type Frozen={
  code:string;name:string;price:number;priorPrice:number;dailyReturn:number;
  relativeReturn:number;rank:number;kind:"RESISTANCE"|"REBOUND_WATCH";
};
type Capture={
  status:string;reason?:string;date?:string;previousDate?:string;
  nikkeiClose?:number;nikkeiPriorClose?:number;benchmarkReturn?:number;
  currentCount?:number;comparableCount?:number;
  groups?:{RESISTANCE:Frozen[];REBOUND_WATCH:Frozen[]};
};
type EventRow={
  id:string;date:string;previous_date:string;nikkei_close:number|string;
  previous_close:number|string;selected_at:string;
};
async function readSaved(dates:string[]):Promise<SavedPrice[]>{
 if(!dates.length)return [];
 const r=await pool.query<SavedPrice>(
  `SELECT date,code,name,price FROM public.daily_stock_results
   WHERE date=ANY($1::text[]) AND price>0
   ORDER BY date DESC,code,created_at DESC NULLS LAST`,[dates]);
 return r.rows;
}
const hash=(data:unknown)=>createHash("sha256").update(JSON.stringify(data)).digest("hex");
/** Insert header and all candidates in ONE transaction, sealed and immutable. */
async function persistFrozen(capture:Capture) {
 if(capture.status!=="READY"||!capture.date||!capture.previousDate||!capture.groups)
   return {status:"NOT_ELIGIBLE"};
 const combined=[...capture.groups.RESISTANCE,...capture.groups.REBOUND_WATCH];
 if(combined.length===0)return {status:"SKIPPED",reason:"NO_CLASSIFIED_CANDIDATES"};
 const fingerprint=hash({version:CRASH_FORWARD_VERSION,date:capture.date,
  previousDate:capture.previousDate,nikkeiClose:capture.nikkeiClose,
  candidates:combined.map(s=>[s.kind,s.rank,s.code,s.price,s.priorPrice,s.dailyReturn,s.relativeReturn])});
 const conn=await pool.connect();
 try{
  await conn.query("BEGIN");
  const r=await conn.query<{id:string}>(
   `INSERT INTO public.crash_forward_events
     (trade_date,previous_trade_date,nikkei_close,nikkei_previous_close,
      nikkei_day_return,baseline_stock_count,comparable_stock_count,
      captured_version,selection_hash)
    VALUES($1::date,$2::date,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (trade_date) DO NOTHING RETURNING id`,
   [capture.date,capture.previousDate,capture.nikkeiClose,capture.nikkeiPriorClose,
    capture.benchmarkReturn,capture.currentCount,capture.comparableCount,
    CRASH_FORWARD_VERSION,fingerprint]);
  if(!r.rows[0]){
    await conn.query("COMMIT");
    return {status:"ALREADY_FROZEN",date:capture.date};
  }
  const inserted=await conn.query(
   `INSERT INTO public.crash_forward_candidates
      (event_id,category,rank,code,name,signal_close,previous_close,daily_return,excess_return)
    SELECT $1::bigint,j.category,j.rank,j.code,j.name,
      j.price,j.prior_price,j.daily_return,j.excess_return
    FROM jsonb_to_recordset($2::jsonb)
      AS j(category text,rank integer,code text,name text,price numeric,
           prior_price numeric,daily_return numeric,excess_return numeric)`,
    [r.rows[0].id,JSON.stringify(combined.map(s=>({
      category:s.kind,rank:s.rank,code:s.code,name:s.name,
      price:s.price,prior_price:s.priorPrice,
      daily_return:s.dailyReturn,excess_return:s.relativeReturn,
    })))]);
  if(inserted.rowCount!==combined.length)throw Error("CANDIDATE_ATOMIC_INSERT_MISMATCH");
  await conn.query("COMMIT");
  return {status:"FROZEN",date:capture.date,count:combined.length,
    resistance:capture.groups.RESISTANCE.length,rebound:capture.groups.REBOUND_WATCH.length,
    selectionHash:fingerprint.slice(0,12)};
 }catch(error){await conn.query("ROLLBACK");throw error;}
 finally{conn.release();}
}
async function evaluateEarlierEvents(marketRows:unknown[],today:string){
 const existing=await pool.query<EventRow>(`
   SELECT e.id,e.trade_date::text AS date,e.previous_trade_date::text AS previous_date,
     e.nikkei_close,e.nikkei_previous_close,e.selected_at
   FROM public.crash_forward_events e
   WHERE e.trade_date<$1::date
     AND EXISTS(SELECT 1 FROM public.crash_forward_candidates c
       LEFT JOIN public.crash_forward_outcomes o ON o.candidate_id=c.id
       WHERE c.event_id=e.id AND o.candidate_id IS NULL)
   ORDER BY e.trade_date LIMIT 30`,[today]);
 const statuses=[];
 const sessions=selectSessions(marketRows);
 for(const event of existing.rows){
  const i=sessions.findIndex((s:{date:string})=>s.date===event.date);
  const next=i<0?null:sessions[i+1];
  if(!next||next.date>today){
   statuses.push({date:event.date,status:"WAIT_NEXT_SESSION"});continue;
  }
  const frozenRows=await pool.query<{
   code:string;name:string;kind:"RESISTANCE"|"REBOUND_WATCH";rank:number;
   price:number|string;daily_return:number|string;
  }>(`SELECT code,name,category AS kind,rank,signal_close AS price,daily_return
      FROM public.crash_forward_candidates WHERE event_id=$1 ORDER BY category,rank`,[event.id]);
  const groups:{RESISTANCE:Frozen[];REBOUND_WATCH:Frozen[]}={RESISTANCE:[],REBOUND_WATCH:[]};
  for(const s of frozenRows.rows){
    groups[s.kind].push({
      code:s.code,name:s.name,kind:s.kind,rank:Number(s.rank),
      price:Number(s.price),dailyReturn:Number(s.daily_return),
      priorPrice:0,relativeReturn:0,
    });
  }
  const result=evaluateFrozenCandidates({
    snapshot:{date:event.date,nikkeiClose:Number(event.nikkei_close),groups},
    marketRows,
    priceRows:await readSaved([next.date]),asOfDate:today,
  });
  if(result.status!=="READY"){
    statuses.push({date:event.date,status:result.status,reason:result.reason});continue;
  }
  const data=result.outcomes.map(x=>({
    category:x.kind,code:x.code,next_close:x.nextPrice,
    stock_return:x.return1,excess_return:x.excess1,beat_nikkei:x.beatMarket,status:x.status,
  }));
  const conn=await pool.connect();
  try{
    await conn.query("BEGIN");
    const r=await conn.query(`
      INSERT INTO public.crash_forward_outcomes
        (candidate_id,next_trade_date,next_close,nikkei_next_return,
          stock_return,excess_return,beat_nikkei,status)
      SELECT c.id,$2::date,j.next_close,$3::numeric,j.stock_return,
        j.excess_return,j.beat_nikkei,j.status
      FROM jsonb_to_recordset($4::jsonb)
        AS j(category text,code text,next_close numeric,
          stock_return numeric,excess_return numeric,beat_nikkei boolean,status text)
      JOIN public.crash_forward_candidates c ON c.event_id=$1::bigint
        AND c.category=j.category AND c.code=j.code
      ON CONFLICT (candidate_id) DO NOTHING`,
      [event.id,result.nextSessionDate,result.benchmarkReturn,JSON.stringify(data)]);
    await conn.query("COMMIT");
    statuses.push({date:event.date,status:"EVALUATED",newOutcomes:r.rowCount,
      nextSession:result.nextSessionDate});
  }catch(error){await conn.query("ROLLBACK");throw error;}
  finally{conn.release();}
 }
 return statuses;
}
export async function runCrashForwardDaily(now=new Date()){
 const {date,minutes}=jstClock(now);
 if(minutes<16*60+45||minutes>=21*60)
  return {success:true,enabled:true,reason:"OUTSIDE_SETTLED_SESSION_WINDOW",date};
 const references=await getCrashMarketReferences(addOneDay(date));
 const marketRows=references.marketRows;
 if(!references.nikkeiAvailable)
  return {success:false,reason:"NIKKEI_REFERENCE_UNAVAILABLE",date};
 // Outcomes of previously sealed cohorts are processed before today's selection.
 const evaluated=await evaluateEarlierEvents(marketRows,date);
 const sessions=selectSessions(marketRows);
 const newest=sessions.at(-1);
 if(!newest||newest.date!==date)
  return {success:true,reason:"NO_TODAY_INDEX_BAR",evaluated,date};
 const prior=sessions.at(-2);
 if(!prior)return {success:true,reason:"NO_PREVIOUS_SESSION",evaluated,date};
 // Check for previous freeze before reading all ~950 stocks, but still settle prior events.
 const old=await pool.query("SELECT id FROM public.crash_forward_events WHERE trade_date=$1::date LIMIT 1",[date]);
 if(old.rowCount)return {success:true,capture:{status:"ALREADY_FROZEN"},evaluated,date};
 const candidate=captureFrozenCrash({marketRows,
  priceRows:await readSaved([prior.date,date]),now}) as Capture;
 const captured=await persistFrozen(candidate);
 return {success:true,date,mode:"OWNER_ONLY_NO_TRADES_NO_NOTIFICATIONS",
   capture: candidate.status==="READY"?captured:candidate,evaluated};
}
