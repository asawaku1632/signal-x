// Pure read-only audit summary. No automatic release or trading activation.
export type AuditInput={recorded:number;evaluated:number;historyCount:number;historyTruncated:boolean;status:string;reasons:string[];entries:Array<{digest:string;valid:boolean;issues:string[]}>};
export function summarizeIntegratedAudit(input:AuditInput){
 const issues:string[]=[];
 if(!Number.isSafeInteger(input.recorded)||input.recorded<0||!Number.isSafeInteger(input.evaluated)||input.evaluated<0||input.evaluated>input.recorded)issues.push("INVALID_RESEARCH_COUNTS");
 if(!Number.isSafeInteger(input.historyCount)||input.historyCount<0||input.historyCount!==input.entries.length)issues.push("INVALID_HISTORY_COUNT");
 if(input.historyTruncated||input.historyCount>=50)issues.push("HISTORY_INCOMPLETE");
 if(input.entries.length===0)issues.push("NO_EVIDENCE_ROWS");
 if(input.entries.some(e=>!e.valid))issues.push("INVALID_EVIDENCE_ROWS");
 if(input.entries.some(e=>!/^[a-f0-9]{64}$/.test(e.digest)))issues.push("INVALID_DIGEST");
 if(input.entries.some(e=>e.issues.length>0))issues.push("EVIDENCE_ROW_ISSUES");
 if(input.status!=="BLOCKED")issues.push("UNEXPECTED_APPROVAL_STATUS");
 if(!input.reasons.includes("INDEPENDENT_PROVENANCE_AND_HISTORY_COMPLETENESS_NOT_ATTESTED"))issues.push("ATTESTATION_WARNING_MISSING");
 const uniqueDigests=new Set(input.entries.map(e=>e.digest));
 if(uniqueDigests.size>1)issues.push("MULTIPLE_EVIDENCE_VERSIONS_REQUIRE_REVIEW");
 return {status:"BLOCKED" as const,issues,verifiedRows:input.entries.filter(e=>e.valid).length,
  pendingRows:input.entries.filter(e=>!e.valid).length,historyComplete:false as const,
  adoptionApproved:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
