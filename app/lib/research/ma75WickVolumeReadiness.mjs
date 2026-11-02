/** Research-only readiness gate: never authorizes production or notifications. */
export function evaluateMa75ForwardReadiness({classification,outcome,sourceAuthenticated=false,forwardValidated=false}={}){
 const blockers=[];
 if(classification?.eligible!==true)blockers.push('SIGNAL_NOT_ELIGIBLE');
 if(classification?.provenanceStatus!=='TIMING_PLAUSIBLE_NOT_AUTHENTICATED'||sourceAuthenticated!==true)blockers.push('SOURCE_NOT_AUTHENTICATED');
 if(outcome?.status!=='HYPOTHETICAL_ONLY'||outcome?.fillVerified!==true)blockers.push('FILL_NOT_VERIFIED');
 if(outcome?.budgetEligible!==true)blockers.push('BUDGET_NOT_ELIGIBLE');
 if(forwardValidated!==true)blockers.push('FORWARD_VALIDATION_MISSING');
 return {status:'SHADOW_NOT_APPROVED',approved:false,blockers};
}
