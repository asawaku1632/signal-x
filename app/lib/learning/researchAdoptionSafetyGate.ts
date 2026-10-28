// Research-only decision gate: evidence summaries cannot authorize production adoption.
export type ResearchAdoptionInput={ruleVersion:string;sampled:number;eligible:number;reviewRequired:number;pending:number;verifiedScope:number;independentProvenance:boolean;licenseAttested:boolean;timestampAttested:boolean;forwardMonths:number;forwardTradingDays:number;holdoutVerified:boolean;regimeCoverageVerified:boolean;humanApproved:boolean};
export function assessResearchAdoption(input:ResearchAdoptionInput){
 const reasons:string[]=[];
 if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(input.ruleVersion))reasons.push("INVALID_RULE_VERSION");
 for(const key of ["sampled","eligible","reviewRequired","pending","verifiedScope","forwardMonths","forwardTradingDays"] as const){
  const n=input[key];if(!Number.isSafeInteger(n)||n<0||n>10000000)reasons.push("INVALID_"+key.toUpperCase());
 }
 if(reasons.length)return {status:"BLOCKED" as const,reasons,eligibleForReview:false,productionApplied:false as const,notificationEnabled:false as const};
 if(input.sampled!==input.eligible||input.sampled===0)reasons.push("INCOMPLETE_SCOPE");
 if(input.pending>0||input.reviewRequired>0||input.verifiedScope!==input.sampled)reasons.push("UNRESOLVED_EVIDENCE");
 if(!input.independentProvenance)reasons.push("PROVENANCE_MISSING");
 if(!input.licenseAttested)reasons.push("LICENSE_MISSING");
 if(!input.timestampAttested)reasons.push("TIMESTAMP_MISSING");
 if(input.forwardMonths<3||input.forwardTradingDays<40)reasons.push("FORWARD_COVERAGE_INSUFFICIENT");
 if(!input.holdoutVerified)reasons.push("HOLDOUT_MISSING");
 if(!input.regimeCoverageVerified)reasons.push("REGIME_COVERAGE_MISSING");
 if(!input.humanApproved)reasons.push("HUMAN_APPROVAL_MISSING");
 // Even a zero-gap research checklist is only an assessment, not an activation instruction.
 return {status:"BLOCKED" as const,reasons:reasons.length?reasons:["INDEPENDENT_ADOPTION_AUDIT_REQUIRED"],eligibleForReview:reasons.length===0,
 productionApplied:false as const,notificationEnabled:false as const};
}
