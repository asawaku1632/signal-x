import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getLatestScanSnapshot } from "@/app/lib/scanSnapshot";
import { inspectBbSourceStock } from "@/app/lib/research/bbSignalProvenance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  if (!(await getLearningOwnerSession()).isOwner) return NextResponse.json({success:false,reason:"OWNER_ONLY"},{status:403,headers});
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "research/morning-quote-metadata-diagnostics-20261026" || process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true")
    return NextResponse.json({success:false,reason:"RESEARCH_PREVIEW_ONLY"},{status:403,headers});
  try {
    const snapshot = await getLatestScanSnapshot();
    if (!snapshot) return NextResponse.json({success:true,found:false,saved:false},{headers});
    const updatedAt = snapshot.updatedAt;
    if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) return NextResponse.json({success:false,reason:"INVALID_SNAPSHOT_TIME"},{status:422,headers});
    const stocks = snapshot.payload?.stocks;
    if (!Array.isArray(stocks)) return NextResponse.json({success:false,reason:"INVALID_STOCKS"},{status:422,headers});
    const parts = new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(updatedAt));
    const part = (type:string) => parts.find(x=>x.type===type)?.value ?? "";
    const date = [part("year"),part("month"),part("day")].join("-");
    const checked = stocks.slice(0,1000).map(stock=>inspectBbSourceStock(stock,updatedAt,date));
    const reasons:Record<string,number> = {};
    const missingBb = stocks.filter(stock=>!stock?.bollinger).map(stock=>({code:String(stock?.code??""),quoteTimestamp:stock?.latestBarTimestamp??null,dataSource:stock?.dataSource??null}));
    const sourceModes:Record<string,number> = {};
    const signalSides:Record<string,number> = {};
    const mismatches = checked.filter(row=>row.reasons.includes("TRADE_DATE_MISMATCH")).map(row=>({code:row.code,signalDate:row.signalDate,quoteAt:row.quoteAt,snapshotUpdatedAt:row.snapshotUpdatedAt,sourceMode:row.sourceMode}));
    for(const row of checked){
      const mode = row.sourceMode ?? "UNKNOWN";
      sourceModes[mode] = (sourceModes[mode] ?? 0) + 1;
      const side = typeof row.signalSide === "string" ? row.signalSide : "UNKNOWN";
      signalSides[side] = (signalSides[side] ?? 0) + 1;
    }
    for(const row of checked) for(const reason of row.reasons) reasons[reason]=(reasons[reason]??0)+1;
    return NextResponse.json({success:true,mode:"READ_ONLY_BB_SNAPSHOT_AUDIT",saved:false,productionApplied:false,snapshotUpdatedAt:updatedAt,inspected:checked.length,total:stocks.length,eligible:0,reasonCounts:reasons,missingBbCount:missingBb.length,missingBbSamples:missingBb.slice(0,15),sourceModes,signalSides,dateMismatches:mismatches,sample:checked.slice(0,5)},{headers});
  } catch {return NextResponse.json({success:false,reason:"SNAPSHOT_READ_FAILED"},{status:503,headers});}
}
