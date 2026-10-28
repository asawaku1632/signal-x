import {evaluateAIResearchCandidate,type ResearchCandidate} from "@/app/lib/learning/aiResearchAdoptionCandidate";
export type PairedOutcome={key:string;baselineReturn5d:number;shadowReturn5d:number;isForward:boolean};
export function compareShadowBaseline(candidate:ResearchCandidate,rows:PairedOutcome[]){
 const gate=evaluateAIResearchCandidate(candidate);
 const issues=[...gate.reasons];
 if(!Array.isArray(rows)||rows.length<2||rows.length>1000)issues.push("INVALID_PAIRED_SAMPLE_SIZE");
 const seen=new Set<string>();
 let sum=0,positive=0,negative=0;
 for(const row of Array.isArray(rows)?rows.slice(0,1001):[]){
  if(!/^[a-zA-Z0-9_:-]{1,100}$/.test(row?.key??"")||seen.has(row.key))issues.push("INVALID_OR_DUPLICATE_PAIR_KEY");
  seen.add(row.key);
  if(row.isForward!==true)issues.push("NOT_FORWARD_PAIR");
  if(!Number.isFinite(row.baselineReturn5d)||!Number.isFinite(row.shadowReturn5d))issues.push("NONFINITE_RETURN");
  else {const diff=row.shadowReturn5d-row.baselineReturn5d;sum+=diff;if(diff>0)positive++;if(diff<0)negative++;}
 }
 const valid=issues.length===0;
 return {status:valid?"SHADOW_COMPARISON_REVIEW_ONLY" as const:"BLOCKED" as const,
  issues:[...new Set(issues)],pairedCount:rows?.length??0,
  meanDifference5d:valid?sum/rows.length:null,positivePairs:valid?positive:null,negativePairs:valid?negative:null,
  independentlyProvenImprovement:false as const,adoptionApproved:false as const,aiPowerChanged:false as const,
  productionApplied:false as const,notificationEnabled:false as const,tradingEnabled:false as const};
}
