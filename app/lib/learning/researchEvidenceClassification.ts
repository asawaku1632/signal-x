export type ResearchEvidenceState="VERIFIED_SCOPE"|"PENDING"|"REVIEW_REQUIRED";
export type ResearchEvidenceRow={id:string;hasOutcome:boolean;calendarIssue:string|null;sourceVerified:boolean;licenseVerified:boolean;independentTimestampVerified:boolean;forwardVerified:boolean;isSample:boolean};
export function classifyResearchEvidence(row:ResearchEvidenceRow):{state:ResearchEvidenceState;reasons:string[];adoptionApproved:false;notificationEnabled:false}{
 const reasons:string[]=[];
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(row.id))reasons.push("INVALID_ID");
 if(row.calendarIssue)reasons.push("CALENDAR_"+row.calendarIssue);
 if(!row.hasOutcome)reasons.push("OUTCOME_PENDING");
 if(!row.sourceVerified)reasons.push("SOURCE_UNVERIFIED");
 if(!row.licenseVerified)reasons.push("LICENSE_UNVERIFIED");
 if(!row.independentTimestampVerified)reasons.push("TIMESTAMP_UNVERIFIED");
 if(!row.forwardVerified)reasons.push("FORWARD_UNVERIFIED");
 if(row.isSample)reasons.push("SAMPLE_NOT_EXHAUSTIVE");
 const requiresReview=reasons.some(x=>x==="INVALID_ID"||x.startsWith("CALENDAR_"));
 return {state:requiresReview?"REVIEW_REQUIRED":reasons.length?"PENDING":"VERIFIED_SCOPE",reasons,adoptionApproved:false,notificationEnabled:false};
}
export function summarizeResearchEvidence(rows:ResearchEvidenceRow[]){
 if(rows.length>1000)throw Error("EVIDENCE_SUMMARY_LIMIT");
 const counts={verifiedScope:0,pending:0,reviewRequired:0,total:rows.length};
 for(const row of rows){const state=classifyResearchEvidence(row).state;if(state==="VERIFIED_SCOPE")counts.verifiedScope++;else if(state==="PENDING")counts.pending++;else counts.reviewRequired++;}
 return {...counts,allIndependentlyVerified:rows.length>0&&counts.verifiedScope===rows.length,adoptionApproved:false as const,productionApplied:false as const};
}
