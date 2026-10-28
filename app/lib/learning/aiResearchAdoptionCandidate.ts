import {evaluateForwardProof,type ForwardProof} from "@/app/lib/learning/forwardProofGate";
// Explicit shadow-only candidate; no path may activate signals or notifications.
export type ResearchCandidate={candidateId:string;proof:ForwardProof;baselineFingerprint:string;candidateFingerprint:string;outOfSampleCompared:boolean;leakageAudited:boolean;independentReviewerApproved:boolean};
export function evaluateAIResearchCandidate(input:ResearchCandidate){
 const forward=evaluateForwardProof(input.proof);
 const reasons=[...forward.issues];
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(input.candidateId))reasons.push("INVALID_CANDIDATE_ID");
 if(!/^[a-f0-9]{32}$/.test(input.baselineFingerprint)||!/^[a-f0-9]{32}$/.test(input.candidateFingerprint))reasons.push("INVALID_COMPARISON_FINGERPRINT");
 if(input.baselineFingerprint===input.candidateFingerprint)reasons.push("NO_INDEPENDENT_COMPARISON_VERSION");
 if(!input.outOfSampleCompared)reasons.push("NO_OUT_OF_SAMPLE_COMPARISON");
 if(!input.leakageAudited)reasons.push("LEAKAGE_AUDIT_MISSING");
 if(!input.independentReviewerApproved)reasons.push("INDEPENDENT_REVIEW_MISSING");
 return {state:reasons.length?"BLOCKED" as const:"SHADOW_REVIEW_CANDIDATE" as const,reasons,
  outcome:"REQUIRES_SEPARATE_HUMAN_AND_DEPLOYMENT_APPROVAL" as const,
  profitVerified:false as const,aiPowerChanged:false as const,productionApplied:false as const,
  tradingEnabled:false as const,notificationEnabled:false as const};
}
