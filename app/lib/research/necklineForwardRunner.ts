import "server-only";
import pool from "@/app/lib/postgres";
import {
  isTseTradingDate,
  resolveTseTradingDatesAfter,
  TSE_MARKET_CALENDAR_VERSION,
} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {fetchNecklineStableCohort} from "@/app/lib/research/shadowCandleYahoo";
import {
  evaluateFrozenNecklineOutcome,
  selectFrozenNecklineCandidate,
  necklineForwardQualitySummary,
  NECKLINE_FORWARD_VERSION,
  NECKLINE_FORWARD_CODES,
  NECKLINE_FORWARD_BATCH_SIZE,
  NECKLINE_FORWARD_BATCH_COUNT,
} from "./necklineForwardCore.mjs";

type ObservedRow={code:string;signal_date:string;horizon:number};
const TIME_ZONE="Asia/Tokyo";
function dateJst(now:Date){
  return now.toLocaleDateString("sv-SE",{timeZone:TIME_ZONE});
}
function jstMinutes(now:Date){
  const str=now.toLocaleTimeString("en-GB",{timeZone:TIME_ZONE,hour:"2-digit",minute:"2-digit",hour12:false});
  const [h,m]=str.split(":").map(Number);
  return h*60+m;
}
function previousSession(today:string) {
  const base=Date.parse(today+"T00:00:00Z");
  for(let i=1;i<=14;i++){
    const d=new Date(base-i*86400_000).toISOString().slice(0,10);
    if(isTseTradingDate(d))return d;
  }
  throw Error("NO_PREVIOUS_EXCHANGE_SESSION");
}
function preopen(now:Date, batch:number){
  const today=dateJst(now),minute=jstMinutes(now);
  if(!Number.isInteger(batch)||batch<0||batch>=NECKLINE_FORWARD_BATCH_COUNT)
    return {ok:false,today,reason:"INVALID_BATCH"};
  try {
    if(!isTseTradingDate(today))
      return {ok:false,today,reason:"JPX_CLOSED"};
  }catch{return {ok:false,today,reason:"EXCHANGE_CALENDAR_UNAVAILABLE"};}
  // Blocks all post-open and posthoc retroactive signal creation.
  if(minute<8*60+20||minute>=8*60+55)
    return {ok:false,today,reason:"OUTSIDE_PREOPEN_CAPTURE_WINDOW"};
  return {ok:true,today,prior:previousSession(today)};
}

/**
 * Exactly three independent 5-code partitions, weekdays 08:25, :35, :45 JST.
 * Unique (run_date,batch) claim is permanent, including failed attempts.
 * Only prior trading day data may be frozen; no missing stock is backfilled.
 * Outcome updates are PENDING->COMPLETE only and require precise JPX sessions.
 */
export async function runNecklineForwardPreopen(batch:number, now=new Date()) {
  const gate=preopen(now,batch);
  if(!gate.ok)return {success:true,skipped:true,date:gate.today,reason:gate.reason};
  const {today,prior}=gate;
  if(!prior) return {success:false,skipped:true,date:today,reason:"PRIOR_SESSION_UNRESOLVED"};
  const codes=NECKLINE_FORWARD_CODES.slice(batch*NECKLINE_FORWARD_BATCH_SIZE,(batch+1)*NECKLINE_FORWARD_BATCH_SIZE);
  if(codes.length!==NECKLINE_FORWARD_BATCH_SIZE)throw Error("FROZEN_COHORT_INTEGRITY_FAILURE");
  const claim=await pool.query<{run_date:string}>(`
    INSERT INTO public.neckline_forward_runs
      (run_date,batch,signal_date,policy_version,codes)
    VALUES ($1::date,$2,$3::date,$4,$5::text[])
    ON CONFLICT (run_date,batch) DO NOTHING
    RETURNING run_date::text
  `,[today,batch,prior,NECKLINE_FORWARD_VERSION,codes]);
  if(!claim.rows.length)
    return {success:true,skipped:true,date:today,batch,reason:"ALREADY_CLAIMED"};

  try {
    const loaded=await fetchNecklineStableCohort(codes);
    const quality=necklineForwardQualitySummary(loaded,prior);
    // External requests may run out of time. A late archive is NOT permitted
    // to claim it was already frozen before the opening bell.
    const stillBeforeOpen=dateJst(new Date())===today && jstMinutes(new Date())<9*60;
    const client=await pool.connect();
    let captured=0,settled=0;
    try {
      await client.query("BEGIN");
      for(const stock of loaded){
        if(stock.error || stock.latestDate!==prior)continue;
        if(stillBeforeOpen){
          const frozen=selectFrozenNecklineCandidate(stock,prior,today);
          if(frozen){
            const inserted=await client.query<{code:string}>(`
              INSERT INTO public.neckline_forward_candidates
              (policy_version,code,signal_date,first_seen_time,observed_preopen_date,
                signal_close,low1,low2,neckline,first_bottom_time,second_bottom_time,
                asof_features,input_bars,source_sha256)
              SELECT $1,$2,$3::date,$4,$5::date,$6,$7,$8,$9,$10,$11,
                $12::jsonb,$13::jsonb,$14
              WHERE (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::time < time '09:00'
              ON CONFLICT (policy_version,code,signal_date) DO NOTHING
              RETURNING code
            `,[
              frozen.policyVersion,frozen.code,frozen.signalDate,frozen.firstSeenTime,
              frozen.observedPreopenDate,frozen.signalClose,frozen.low1,frozen.low2,
              frozen.neckline,frozen.firstBottomTime,frozen.secondBottomTime,
              JSON.stringify(frozen.asofFeatures),JSON.stringify(frozen.inputBars),frozen.sourceSha256,
            ]);
            if(inserted.rows.length){
              captured++;
              await client.query(`
                INSERT INTO public.neckline_forward_outcomes
                (policy_version,code,signal_date,horizon) VALUES
                ($1,$2,$3::date,3),($1,$2,$3::date,5)
                ON CONFLICT DO NOTHING
              `,[frozen.policyVersion,frozen.code,frozen.signalDate]);
            }
          }
        }
        const {rows:pending}=await client.query<ObservedRow>(`
          SELECT o.code,o.signal_date::text AS signal_date,o.horizon
          FROM public.neckline_forward_outcomes o
          WHERE o.policy_version=$1 AND o.code=$2 AND o.status='PENDING'
            AND o.signal_date<$3::date ORDER BY o.signal_date,o.horizon
          LIMIT 80
        `,[NECKLINE_FORWARD_VERSION,stock.code,prior]);
        for(const row of pending){
          let expected:string[];
          try {
            expected=resolveTseTradingDatesAfter(row.signal_date,5);
          }catch{continue;}
          // No false success when the Yahoo data omits an expected JPX session.
          if(expected[row.horizon-1]>prior)continue;
          const trade=evaluateFrozenNecklineOutcome(
            row.signal_date,stock.candles,expected,row.horizon,
          );
          if(!trade)continue;
          const updated=await client.query(`
            UPDATE public.neckline_forward_outcomes
            SET status='COMPLETE',entry_date=$5::date,exit_date=$6::date,
                entry_open=$7,exit_close=$8,return_percent=$9,
                worst_adverse_percent=$10,evaluation_source_sha256=$11,
                completed_at=clock_timestamp()
            WHERE policy_version=$1 AND code=$2 AND signal_date=$3::date
              AND horizon=$4 AND status='PENDING'
          `,[
            NECKLINE_FORWARD_VERSION,row.code,row.signal_date,row.horizon,
            trade.entryDate,trade.exitDate,trade.entryOpen,trade.exitClose,
            trade.returnPercent,trade.maxAdversePercent,stock.barsSha256,
          ]);
          settled+=updated.rowCount??0;
        }
      }
      const finalStatus=quality.valid===codes.length&&stillBeforeOpen?"COMPLETE":"PARTIAL";
      await client.query(`
        UPDATE public.neckline_forward_runs
        SET status=$3,results=$4::jsonb,finished_at=clock_timestamp(),note=$5
        WHERE run_date=$1::date AND batch=$2 AND status='CLAIMED'
      `,[today,batch,finalStatus,JSON.stringify(quality.results),
        `${quality.valid}/${codes.length} valid, ${captured} new candidates, ${settled} completed horizons; ${stillBeforeOpen?"preopen":"late freeze forbidden"}; calendar=${TSE_MARKET_CALENDAR_VERSION}`]);
      await client.query("COMMIT");
      return {success:true,skipped:false,date:today,signalDate:prior,batch,
        status:finalStatus,requested:codes.length,valid:quality.valid,
        missing:quality.missing,newCandidates:captured,newCompletedHorizons:settled,
        beforeOpen:stillBeforeOpen,source:"YAHOO_1D_RESEARCH_NO_ORDERS"};
    }catch(error){
      await client.query("ROLLBACK").catch(()=>undefined);
      throw error;
    }finally{client.release();}
  }catch(error){
    console.error("[neckline-forward] capture failed",batch,error);
    await pool.query(`
      UPDATE public.neckline_forward_runs
      SET status='FAILED',finished_at=clock_timestamp(),note=$3
      WHERE run_date=$1::date AND batch=$2 AND status='CLAIMED'
    `,[today,batch,error instanceof Error?error.message:"FORWARD_CAPTURE_ERROR"]).catch(()=>undefined);
    return {success:false,skipped:false,date:today,batch,reason:"NECKLINE_FORWARD_CAPTURE_FAILED"};
  }
}
