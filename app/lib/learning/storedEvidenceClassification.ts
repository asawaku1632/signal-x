import pool from "@/app/lib/postgres";
import {UNIVERSE_SWING_RULE_VERSION} from "@/app/lib/learning/swingUniverseAudit";
import {classifyResearchEvidence,summarizeResearchEvidence,type ResearchEvidenceRow} from "@/app/lib/learning/researchEvidenceClassification";
// Owner-only, bounded research evidence preview; no provenance flags are inferred from stored outcome or calendar alone.
export async function readStoredResearchEvidenceClassification(limit=100){
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error("INVALID_EVIDENCE_PREVIEW_LIMIT");
 const result=await pool.query<{trade_date:string;code:string;return_5d:string|null;outcome_5d_date:string|null}>(`
 SELECT trade_date::text,code,return_5d::text,outcome_5d_date::text FROM public.swing_universe_observations
 WHERE rule_version=$1 ORDER BY trade_date DESC,code ASC LIMIT $2`,[UNIVERSE_SWING_RULE_VERSION,limit]);
 const rows:ResearchEvidenceRow[]=result.rows.map((r,i)=>({
  id:r.code,hasOutcome:r.return_5d!==null&&r.outcome_5d_date!==null,
  calendarIssue:null,sourceVerified:false,licenseVerified:false,independentTimestampVerified:false,forwardVerified:false,isSample:true
 }));
 const summary=summarizeResearchEvidence(rows);
 const reasonCounts:Record<string,number>={};
 for(const r of rows)for(const reason of classifyResearchEvidence(r).reasons)reasonCounts[reason]=(reasonCounts[reason]??0)+1;
 return {summary,reasonCounts,sampled:rows.length,limit,exhaustive:false as const,verifiedFromIndependentSources:false as const,ownerReviewOnly:true as const,productionApplied:false as const,notificationEnabled:false as const};
}
