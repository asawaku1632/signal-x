import "server-only";
import {randomUUID} from "node:crypto";
import pool from "@/app/lib/postgres";
import {resolveTseTradingDatesAfter} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {fetchDay} from "@/app/lib/jquantsNightRunner";
import {jquantsCode} from "@/app/lib/jquantsNightData.mjs";
import {evaluateBuyOutcome} from "@/app/lib/freshBuyOutcomes.mjs";
type Event={code:string;trade_date:string;bar_time:number;reference_price:number;detected_at:string};
type Plan=Event&{horizon:number;target_date:string;required_dates:string[]};
export async function captureFreshBuyOutcomes(owner:string,today:string){
 const runId=randomUUID();
 const lease=await pool.query(`INSERT INTO public.owner_new_buy_outcome_runs(owner_email,run_id,run_date,state,started_at)
 VALUES($1,$2::uuid,$3::date,'RUNNING',now()) ON CONFLICT(owner_email) DO UPDATE
 SET run_id=EXCLUDED.run_id,run_date=EXCLUDED.run_date,state='RUNNING',started_at=now(),finished_at=NULL,stats=NULL,note=NULL
 WHERE owner_new_buy_outcome_runs.state<>'RUNNING' OR owner_new_buy_outcome_runs.started_at<now()-interval '10 minutes'
 RETURNING run_id`,[owner,runId,today]);
 if(!lease.rowCount)return {skipped:"RUNNING"};
 const stats={planned:0,completed:0,missing:0,excluded:0,fetchedDates:0,providerErrors:0,calendarErrors:0};
 try{
  const events=await pool.query<Event>(`SELECT e.code,e.trade_date::text,e.bar_time::float8,e.reference_price::float8,e.detected_at::text
   FROM public.owner_new_buy_events e WHERE e.owner_email=$1 AND
    (SELECT count(*) FROM public.owner_new_buy_outcomes o WHERE o.owner_email=e.owner_email AND o.code=e.code AND o.trade_date=e.trade_date)<3
   ORDER BY e.trade_date,e.code LIMIT 1000`,[owner]);
  const planned:Array<{code:string;trade_date:string;horizon:number;target_date:string;required_dates:string[]}>=[];
  for(const e of events.rows){
   try{const dates=resolveTseTradingDatesAfter(e.trade_date,5,{maxLookaheadDays:30});
    for(const horizon of [1,3,5])planned.push({code:e.code,trade_date:e.trade_date,horizon,target_date:dates[horizon-1],required_dates:dates.slice(0,horizon)});
   }catch{stats.calendarErrors++;}
  }
  if(planned.length){
   const insert=await pool.query(`INSERT INTO public.owner_new_buy_outcomes(owner_email,code,trade_date,horizon,target_date,required_dates)
    SELECT $1,p.code,p.trade_date::date,p.horizon,p.target_date::date,p.required_dates::date[]
    FROM jsonb_to_recordset($2::jsonb) p(code text,trade_date text,horizon smallint,target_date text,required_dates text[])
    ON CONFLICT DO NOTHING`,[owner,JSON.stringify(planned)]);
   stats.planned=insert.rowCount??0;
  }
  const pending=await pool.query<Plan>(`SELECT o.code,o.trade_date::text,o.horizon,o.target_date::text,o.required_dates::text[],
   e.bar_time::float8,e.reference_price::float8,e.detected_at::text
   FROM public.owner_new_buy_outcomes o JOIN public.owner_new_buy_events e USING(owner_email,code,trade_date)
   WHERE o.owner_email=$1 AND o.target_date<=$2::date AND o.status IN ('PENDING','DATA_MISSING')
   ORDER BY o.last_attempt_at NULLS FIRST,o.target_date,o.code,o.horizon LIMIT 1000`,[owner,today]);
  if(pending.rows.length){
   const key=process.env.JQUANTS_API_KEY;if(!key)throw Error("JQUANTS_KEY_UNAVAILABLE");
   const dates=[...new Set(pending.rows.flatMap(p=>p.required_dates))].sort().slice(0,20);
   const wanted=new Set(pending.rows.map(p=>p.code));
   const data:Record<string,unknown>[]=[];const attempted=new Set<string>();const deadline=Date.now()+230000;
   for(const date of dates){
    if(Date.now()>deadline)break;
    attempted.add(date);
    try{const rows=await fetchDay(date,key,deadline);stats.fetchedDates++;
     for(const r of rows)if(r&&r.Date===date&&wanted.has(jquantsCode(r.Code)??""))data.push(r);
    }catch{stats.providerErrors++;}
    await new Promise(resolve=>setTimeout(resolve,1100));
   }
   const changes:Array<Record<string,unknown>>=[];
   for(const p of pending.rows){
    if(p.required_dates.some(d=>!attempted.has(d)))continue;
    const result=evaluateBuyOutcome(p,p,data,Date.now());
    if(result.status==="PENDING")continue;
    changes.push({code:p.code,trade_date:p.trade_date,horizon:p.horizon,status:result.status,
      close_price:result.close_price??null,return_pct:result.return_pct??null,evidence:result.evidence??null,note:result.note});
   }
   if(changes.length){
    const updated=await pool.query<{status:string;count:number}>(`WITH changed AS (
     UPDATE public.owner_new_buy_outcomes o SET status=r.status,close_price=r.close_price,return_pct=r.return_pct,
      evidence=r.evidence,note=r.note,last_attempt_at=now(),completed_at=CASE WHEN r.status='COMPLETE' THEN now() ELSE NULL END
     FROM jsonb_to_recordset($2::jsonb) r(code text,trade_date text,horizon smallint,status text,
      close_price numeric,return_pct numeric,evidence jsonb,note text)
     WHERE o.owner_email=$1 AND o.code=r.code AND o.trade_date=r.trade_date::date AND o.horizon=r.horizon
      AND o.status IN ('PENDING','DATA_MISSING') RETURNING o.status)
     SELECT status,count(*)::int AS count FROM changed GROUP BY status`,[owner,JSON.stringify(changes)]);
    for(const r of updated.rows){if(r.status==="COMPLETE")stats.completed+=r.count;else if(r.status==="DATA_MISSING")stats.missing+=r.count;else stats.excluded+=r.count;}
   }
  }
  await pool.query(`UPDATE public.owner_new_buy_outcome_runs SET state='DONE',finished_at=now(),stats=$3::jsonb
   WHERE owner_email=$1 AND run_id=$2::uuid`,[owner,runId,JSON.stringify(stats)]);
  return stats;
 }catch(error){
  await pool.query(`UPDATE public.owner_new_buy_outcome_runs SET state='ERROR',finished_at=now(),stats=$3::jsonb,note=$4
   WHERE owner_email=$1 AND run_id=$2::uuid`,[owner,runId,JSON.stringify(stats),error instanceof Error?error.message:"OUTCOME_CAPTURE_FAILED"]);
  throw error;
 }
}
