import type {EvidenceProof} from "@/app/lib/learning/researchEvidenceLedger";
import {verifyResearchProofs} from "@/app/lib/learning/researchEvidenceLedger";
// Versioned, inert JSON envelope intended for offline evidence exchange.
// No persistent storage, no database reads/writes, no implicit trust.
export type EvidenceEnvelope={schemaVersion:1;researchId:string;ruleVersion:string;createdAt:string;proofs:EvidenceProof[];digest:string};
export function createEvidenceEnvelope(researchId:string,ruleVersion:string,proofs:EvidenceProof[],createdAt:string):EvidenceEnvelope{
 const check=verifyResearchProofs(researchId,ruleVersion,proofs,createdAt);
 if(!check.verified)throw new Error("EVIDENCE_INVALID:"+check.issues.join(","));
 return {schemaVersion:1,researchId,ruleVersion,createdAt,proofs:proofs.map(p=>({...p})),digest:check.digest};
}
export function inspectEvidenceEnvelope(raw:unknown,now:string){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {valid:false,issues:["INVALID_ENVELOPE"]};
 const e=raw as Partial<EvidenceEnvelope>;
 if(e.schemaVersion!==1||typeof e.researchId!=="string"||typeof e.ruleVersion!=="string"||
    typeof e.createdAt!=="string"||!Array.isArray(e.proofs)||typeof e.digest!=="string"||
    e.proofs.length!==5||e.proofs.some(p=>!p||typeof p!=="object"||typeof p.kind!=="string"||
      typeof p.researchId!=="string"||typeof p.ruleVersion!=="string"||typeof p.artifactDigest!=="string"||
      typeof p.verifiedBy!=="string"||typeof p.verifiedAt!=="string"||
      !(p.expiresAt===null||typeof p.expiresAt==="string")))return {valid:false,issues:["INVALID_SCHEMA"]};
 if(!Number.isFinite(Date.parse(e.createdAt))||Date.parse(e.createdAt)>Date.parse(now))return {valid:false,issues:["INVALID_ENVELOPE_DATE"]};
 const result=verifyResearchProofs(e.researchId,e.ruleVersion,e.proofs,now);
 const issues=[...result.issues];
 if(result.digest!==e.digest)issues.push("DIGEST_MISMATCH");
 return {valid:issues.length===0,issues,digest:result.digest,activationPermitted:false as const};
}
