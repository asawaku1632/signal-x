import { createHash } from "node:crypto";
export type ProofKind="SOURCE"|"LICENSE"|"TIMESTAMP"|"HOLDOUT"|"REGIME";
export type EvidenceProof={kind:ProofKind;researchId:string;ruleVersion:string;artifactDigest:string;verifiedBy:string;verifiedAt:string;expiresAt:string|null};
const KINDS:ProofKind[]=["SOURCE","LICENSE","TIMESTAMP","HOLDOUT","REGIME"];
const hex=(s:string)=>/^[a-f0-9]{64}$/.test(s);
export function verifyResearchProofs(researchId:string,ruleVersion:string,proofs:EvidenceProof[],now:string){
 const issues:string[]=[];
 const current=Date.parse(now);
 if(!Number.isFinite(current))issues.push("INVALID_REVIEW_TIME");
 for(const kind of KINDS){
  const matching=proofs.filter(p=>p.kind===kind);
  if(matching.length!==1){issues.push("MISSING_OR_DUPLICATE_"+kind);continue;}
  const p=matching[0];
  if(p.researchId!==researchId||p.ruleVersion!==ruleVersion)issues.push("WRONG_SCOPE_"+kind);
  if(!hex(p.artifactDigest)||!p.verifiedBy.trim())issues.push("INVALID_PROOF_"+kind);
  const stamped=Date.parse(p.verifiedAt);
  if(!Number.isFinite(stamped)||stamped>current)issues.push("INVALID_TIME_"+kind);
  if(p.expiresAt!==null&&(!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=current))issues.push("EXPIRED_"+kind);
 }
 if(proofs.some(p=>!KINDS.includes(p.kind)))issues.push("UNKNOWN_PROOF_KIND");
 const canonical=proofs.map(p=>[p.kind,p.researchId,p.ruleVersion,p.artifactDigest,p.verifiedBy,p.verifiedAt,p.expiresAt??""].join("|")).sort().join("\n");
 const digest=createHash("sha256").update(canonical,"utf8").digest("hex");
 return {verified:issues.length===0,issues,digest,proofCount:proofs.length,activationPermitted:false as const};
}
