export type ProofGate = "PROVEN"|"MISSING"|"CONFLICT"|"EXPIRED";
export type ResearchProof = {observationId:string;source:ProofGate;license:ProofGate;signalTime:ProofGate;barEndTime:ProofGate;forwardOutcome:ProofGate;marketCalendar:ProofGate;holdout:ProofGate;regimeReproducibility:ProofGate;historyCompleteness:ProofGate;independentVerification:ProofGate};
export const PROOF_FIELDS=["source","license","signalTime","barEndTime","forwardOutcome","marketCalendar","holdout","regimeReproducibility","historyCompleteness","independentVerification"] as const;
export function assessProofGates(proof:ResearchProof){
 const issues:string[]=[];let confirmed=0;
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(proof.observationId))issues.push("INVALID_OBSERVATION_ID");
 for(const field of PROOF_FIELDS){
  const value=proof[field];
  if(value==="PROVEN")confirmed++;
  else if(value==="MISSING"||value==="CONFLICT"||value==="EXPIRED")issues.push(field.toUpperCase()+"_"+value);
  else issues.push(field.toUpperCase()+"_INVALID");
 }
 const state=issues.some(x=>x.endsWith("_CONFLICT")||x.endsWith("_INVALID")||x==="INVALID_OBSERVATION_ID")?"REVIEW_REQUIRED":issues.length?"PENDING":"VERIFIED_SCOPE";
 return {state,confirmed,required:PROOF_FIELDS.length,issues,canAdopt:false as const,canNotify:false as const,productionApplied:false as const,requiresSeparateHumanApproval:true as const};
}
export function summarizeProofGates(proofs:ResearchProof[]){
 if(proofs.length>1000)throw Error("PROOF_SUMMARY_LIMIT");
 let verifiedScope=0,pending=0,reviewRequired=0;const missingByGate:Record<string,number>={};
 for(const proof of proofs){const result=assessProofGates(proof);
  if(result.state==="VERIFIED_SCOPE")verifiedScope++;else if(result.state==="PENDING")pending++;else reviewRequired++;
  for(const issue of result.issues)missingByGate[issue]=(missingByGate[issue]??0)+1;
 }
 return {total:proofs.length,verifiedScope,pending,reviewRequired,missingByGate,adoptionApproved:false as const,notificationEnabled:false as const,exhaustive:false as const};
}
