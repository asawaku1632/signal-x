import pool from "@/app/lib/postgres";
import {inspectEvidenceEnvelope} from "@/app/lib/learning/researchEvidenceEnvelope";
// Owner-only route must authorize BEFORE calling this function.
// Read-only; any missing schema produces a failure, never invented approvals.
export async function readResearchEvidenceHistory(researchId:string,ruleVersion:string,now=new Date()){
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(researchId)||!/^[a-zA-Z0-9_.-]{1,80}$/.test(ruleVersion))
  throw new Error("INVALID_RESEARCH_SCOPE");
 const result=await pool.query<{digest:string;envelope:unknown;recorded_at:Date|string}>(
  "SELECT digest,envelope,recorded_at FROM public.research_evidence_envelopes WHERE research_id=$1 AND rule_version=$2 ORDER BY recorded_at DESC,id DESC LIMIT 50",
  [researchId,ruleVersion]);
 return {researchId,ruleVersion,items:result.rows.map(row=>{
  const verification=inspectEvidenceEnvelope(row.envelope,now.toISOString());
  return {digest:row.digest,recordedAt:row.recorded_at,valid:verification.valid&&verification.digest===row.digest,issues:verification.issues};
 }),readOnly:true as const,approvalRecorded:false as const,productionApplied:false as const};
}
