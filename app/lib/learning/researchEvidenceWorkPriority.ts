import {RESEARCH_EVIDENCE_REQUIREMENTS} from "@/app/lib/learning/researchEvidenceActionPlan";
export type EvidenceReasonCounts=Record<string,number>;
const priority=["INVALID_ID","CALENDAR_","SOURCE_UNVERIFIED","LICENSE_UNVERIFIED","TIMESTAMP_UNVERIFIED","FORWARD_UNVERIFIED","OUTCOME_PENDING","SAMPLE_NOT_EXHAUSTIVE"];
export function rankResearchEvidenceWork(reasonCounts:EvidenceReasonCounts,sampled:number){
 if(!Number.isSafeInteger(sampled)||sampled<0||sampled>1000)throw Error("INVALID_EVIDENCE_WORK_SAMPLE");
 const work=Object.entries(reasonCounts).map(([code,count])=>{
  if(!/^[A-Z0-9_]{1,100}$/.test(code)||!Number.isSafeInteger(count)||count<0||count>sampled)throw Error("INVALID_EVIDENCE_REASON_COUNT");
  const match=RESEARCH_EVIDENCE_REQUIREMENTS.find(x=>x.code===code);
  const index=priority.findIndex(p=>p.endsWith("_")?code.startsWith(p):p===code);
  return {code,count,rank:index<0?priority.length:index+1,label:match?.label??"異常または追加確認",next:match?.next??"管理者による独立検証が必要"};
 });
 work.sort((a,b)=>a.rank-b.rank||b.count-a.count||a.code.localeCompare(b.code));
 return {work,sampled,completeHistory:false as const,independentlyVerified:false as const,adoptionApproved:false as const,productionApplied:false as const};
}
