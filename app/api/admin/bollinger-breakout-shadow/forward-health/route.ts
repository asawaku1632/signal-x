import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {prospectiveProgress} from "@/app/lib/research/bollingerForwardRunner";

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
    const warnings:string[]=[];
    if(!report.enabled)warnings.push("STUDY_DISABLED");
    if(!latest)warnings.push("NO_RECORDED_RUN");
    if(latest&&latest.status!=="COMPLETE")warnings.push("LATEST_RUN_NOT_COMPLETE");
    if(latest&&Number(latest.failed_count)>0)warnings.push("LATEST_RUN_HAS_FAILURES");
    if(Number(coverage.failed)>0)warnings.push("STOCK_CHECK_FAILURES_RECORDED");
    if(Number(coverage.halts)>0)warnings.push("SOURCE_REVISION_HALTS_RECORDED");
    return NextResponse.json({
      success:true,mode:"OWNER_STAGE7_READ_ONLY_HEALTH",
      studyEnabled:report.enabled,activationDate:report.activationDate,
      latestRun:latest,
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
