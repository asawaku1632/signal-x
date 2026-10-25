// Pure policy check; does not replace server-side session verification or RLS.
export function assessDualSurgeOwnerAccess({
 isAuthenticated=false,isOwner=false,sessionExpired=true,
 scope,action="read",rlsVerified=false,csrfVerified=false
}={}){
 const reasons=[];
 if(isAuthenticated!==true)reasons.push("UNAUTHENTICATED");
 if(isOwner!==true)reasons.push("NOT_OWNER");
 if(sessionExpired!==false)reasons.push("SESSION_EXPIRED_OR_UNKNOWN");
 if(scope!=="dual-surge-research")reasons.push("INVALID_SCOPE");
 if(action!=="read")reasons.push("ACTION_NOT_ALLOWED");
 if(rlsVerified!==true)reasons.push("RLS_NOT_VERIFIED");
 if(csrfVerified!==true)reasons.push("REQUEST_INTEGRITY_UNVERIFIED");
 return {allowed:reasons.length===0,reasons,readOnly:true,productionApproved:false};
}
