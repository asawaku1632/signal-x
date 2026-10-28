// Independent fail-closed boundary before any future research adoption.
// This function NEVER authorizes production or notification delivery.
export type CrossAuditInput={
 researchId:string;ruleVersion:string;reviewResearchId:string;reviewRuleVersion:string;
 recorded:number;evaluated:number;validEvidenceRows:number;invalidEvidenceRows:number;
 historyTruncated:boolean;historyComplete:boolean;independentProvenanceVerified:boolean;
 licenseVerified:boolean;holdoutVerified:boolean;regimeVerified:boolean;
 reviewerApproved:boolean;reviewDigestMatches:boolean;approvalStillValid:boolean;
 previousGateBlocked:boolean;notificationEnabled:boolean;productionApplied:boolean;
};
export function crossAuditResearchAdoption(e:CrossAuditInput){
 const issues:string[]=[];
 if(!e.researchId||!e.ruleVersion||e.researchId!==e.reviewResearchId||e.ruleVersion!==e.reviewRuleVersion)issues.push("CROSS_SCOPE_MISMATCH");
 if(!Number.isSafeInteger(e.recorded)||!Number.isSafeInteger(e.evaluated)||e.evaluated<0||e.recorded<0||e.evaluated>e.recorded)issues.push("CROSS_INVALID_COUNTS");
 if(e.validEvidenceRows!==1||e.invalidEvidenceRows!==0)issues.push("CROSS_EVIDENCE_AMBIGUOUS_OR_INVALID");
 if(e.historyTruncated||!e.historyComplete)issues.push("CROSS_HISTORY_INCOMPLETE");
 if(!e.independentProvenanceVerified)issues.push("CROSS_PROVENANCE_UNVERIFIED");
 if(!e.licenseVerified)issues.push("CROSS_LICENSE_UNVERIFIED");
 if(!e.holdoutVerified)issues.push("CROSS_HOLDOUT_UNVERIFIED");
 if(!e.regimeVerified)issues.push("CROSS_REGIME_UNVERIFIED");
 if(!e.reviewerApproved||!e.reviewDigestMatches||!e.approvalStillValid)issues.push("CROSS_REVIEW_NOT_VALID");
 if(e.previousGateBlocked)issues.push("CROSS_PREVIOUS_GATE_BLOCKED");
 if(e.notificationEnabled||e.productionApplied)issues.push("CROSS_UNEXPECTED_ACTIVATION");
 return {status:"BLOCKED" as const,issues,checksPassed:issues.length===0,
  eligibleForSeparateHumanReleaseReview:issues.length===0,
  automaticActivation:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
