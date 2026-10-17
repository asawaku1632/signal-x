import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {prospectiveProgress} from "@/app/lib/research/bollingerForwardRunner";
import pool from "@/app/lib/postgres";
import {resolveTseTradingDatesAfter,isTseTargetDateReady} from "@/app/lib/technicalObservation/tseMarketCalendar";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;
const headers={"Cache-Control":"private, no-store"};

export async function GET(){
  if(!(await getLearningOwnerSession()).isOwner)
    return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
  try{
    // Existing Stage 7 data is queried through its established read-only progress path.
    // Never invoke the runner, vendor price retrieval, or activation controls here.
    const report=await prospectiveProgress();
    const runs=Array.isArray(report.runs)?report.runs:[];
    const latest=runs[0]??null;
    const coverage=report.coverage;
    const pending=await pool.query<{horizon:number;pending_count:number}>(`
      SELECT h.horizon,COUNT(*)::int AS pending_count
      FROM public.bb_forward_signals s
      CROSS JOIN (VALUES (1),(3),(5)) AS h(horizon)
      LEFT JOIN public.bb_forward_outcomes o
        ON o.version=s.version AND o.code=s.code
        AND o.signal_time=s.signal_time AND o.horizon=h.horizon
      WHERE o.signal_time IS NULL
      GROUP BY h.horizon ORDER BY h.horizon`);
    const pendingByHorizon=Object.fromEntries(pending.rows.map(r=>[String(r.horizon),Number(r.pending_count)]));
    const recentRuns=runs.slice(0,10).map(r=>({
      tradeDate:r.trade_date,batchId:r.batch_id,status:r.status,
      observedCount:Number(r.observed_count),failedCount:Number(r.failed_count)
    }));
    const frozen=await pool.query<{signal_date:string;code:string;horizon:number}>(`
      SELECT s.signal_date::text,s.code,h.horizon
      FROM public.bb_forward_signals s
      CROSS JOIN (VALUES (1),(3),(5)) AS h(horizon)
      LEFT JOIN public.bb_forward_outcomes o
        ON o.version=s.version AND o.code=s.code
        AND o.signal_time=s.signal_time AND o.horizon=h.horizon
      LEFT JOIN public.bb_forward_signal_halts halt
        ON halt.version=s.version AND halt.code=s.code AND halt.signal_time=s.signal_time
      WHERE o.signal_time IS NULL AND halt.signal_time IS NULL
      ORDER BY s.signal_date,s.code,h.horizon LIMIT 1000`);
    const now=new Date();
    const todayJst=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
    const maturity={notDue:0,dueAwaitingRun:0,overdue:0,calendarUnknown:0};
    for(const row of frozen.rows){
      try{
        const dueDate=resolveTseTradingDatesAfter(row.signal_date,Number(row.horizon)).at(-1)!;
        if(!isTseTargetDateReady(dueDate,now)){maturity.notDue++;continue;}
        // Stage 7 only runs after 16:15 JST. Do not flag a due date before that run.
        const cutoff=new Date(dueDate+"T17:30:00+09:00");
        if(now.getTime()<cutoff.getTime()){maturity.dueAwaitingRun++;continue;}
        // Outcome collection is bounded to ten pending stocks per run. A due result
        // is an investigation candidate, not proof that the pipeline failed.
        maturity.overdue++;
      }catch{maturity.calendarUnknown++;}
    }
    const warnings:string[]=[];
    if(!report.enabled)warnings.push("STUDY_DISABLED");
    if(maturity.overdue>0)warnings.push("MATURE_OUTCOMES_PENDING_REVIEW");
    if(maturity.calendarUnknown>0)warnings.push("CALENDAR_RESOLUTION_REQUIRED");
    if(!latest)warnings.push("NO_RECORDED_RUN");
    if(latest&&latest.status!=="COMPLETE")warnings.push("LATEST_RUN_NOT_COMPLETE");
    if(latest&&Number(latest.failed_count)>0)warnings.push("LATEST_RUN_HAS_FAILURES");
    if(Number(coverage.failed)>0)warnings.push("STOCK_CHECK_FAILURES_RECORDED");
    if(Number(coverage.halts)>0)warnings.push("SOURCE_REVISION_HALTS_RECORDED");
    return NextResponse.json({
      success:true,mode:"OWNER_STAGE7_READ_ONLY_HEALTH",
      studyEnabled:report.enabled,activationDate:report.activationDate,
      latestRun:latest,recentRuns,pendingByHorizon,maturity,asOfTradingDateJst:todayJst,
      totals:{signals:Number(coverage.signals),completedOutcomes:Number(coverage.completed),
        failedChecks:Number(coverage.failed),sourceHalts:Number(coverage.halts),
        sampledStocksPerTradingDay:coverage.sampledStocksPerTradingDay,
        fixedUniverse:coverage.fixedUniverse},
      warnings,
      note:"Snapshot only. No provider requests, research writes, or schedule changes."
    },{headers});
  }catch{
    return NextResponse.json({success:false,error:"STAGE7_HEALTH_UNAVAILABLE"},
      {status:503,headers});
  }
}
