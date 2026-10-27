import { createHash } from "node:crypto";

const GENESIS="0".repeat(64);
const FIELDS=["sequence","proposalId","reviewerId","reviewedAt","decision","reason","evidenceSha256","productionApproval","autoApply"];
const canonical=(record)=>JSON.stringify(FIELDS.map((field)=>record[field]));
const digest=(previousHash,record)=>createHash("sha256").update(previousHash+"\n"+canonical(record)).digest("hex");

/**
 * Offline tamper-evident hash chain for research review history.
 * Trust requires an independently preserved chain head; hashes alone cannot
 * prevent rewriting the entire history and recomputing the chain.
 */
export function sealForwardReviewHistory(history) {
  if (!Array.isArray(history)) throw new TypeError("history must be an array");
  let previousHash=GENESIS;
  return history.map((record,index)=>{
    if (!record || record.sequence!==index+1 || record.productionApproval!==false ||
        record.autoApply!==false || FIELDS.some((key)=>record[key]===undefined)) {
      throw new Error("Invalid review history record");
    }
    const hash=digest(previousHash,record);
    const sealed={...record,previousHash,recordHash:hash};
    previousHash=hash;
    return sealed;
  });
}
export function verifyForwardReviewHistoryChain(sealedHistory, expectedHeadHash) {
  if (!Array.isArray(sealedHistory)) throw new TypeError("sealedHistory must be an array");
  let previousHash=GENESIS;
  const issues=[];
  for (const [index,record] of sealedHistory.entries()) {
    if (!record || record.sequence!==index+1 || record.productionApproval!==false ||
        record.autoApply!==false || FIELDS.some((key)=>record?.[key]===undefined)) {
      issues.push(`INVALID_RECORD_${index}`); continue;
    }
    if (record.previousHash!==previousHash) issues.push(`PREVIOUS_HASH_MISMATCH_${index}`);
    const calculated=digest(previousHash,record);
    if (record.recordHash!==calculated) issues.push(`RECORD_HASH_MISMATCH_${index}`);
    previousHash=calculated;
  }
  const headHash=previousHash;
  if (typeof expectedHeadHash!=="string" || !/^[a-f0-9]{64}$/i.test(expectedHeadHash) ||
      headHash!==expectedHeadHash.toLowerCase()) issues.push("TRUSTED_HEAD_MISMATCH_OR_MISSING");
  return {valid:issues.length===0,status:issues.length?"INTEGRITY_FAILED":"INTEGRITY_MATCH",
    headHash,issues,recordCount:sealedHistory.length,productionApproved:false};
}
