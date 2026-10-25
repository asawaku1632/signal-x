// Aggregates independent offline checks. A passing fixture is never a deployment approval.
import {evaluateReadiness} from "./dualSurgeReadiness.mjs";
import {assessProviderScope} from "./dualSurgeProviderScope.mjs";
import {assessSessionFreshness} from "./dualSurgeSessionFreshness.mjs";
import {assessReplayProvenance} from "./dualSurgeReplayProvenance.mjs";
import {assessDevDatabaseIsolation} from "./dualSurgeDevDatabaseGuard.mjs";
import {assessDualSurgeOwnerAccess} from "./dualSurgeOwnerAccess.mjs";
import {assessDualSurgeSample} from "./dualSurgeStatisticalAudit.mjs";
import {auditForwardOutcomes} from "./dualSurgeForwardAudit.mjs";
export function auditDualSurgeRelease(input={}){
 const checks={
  evidence:evaluateReadiness(input.evidence??{}).verified,
  provider:assessProviderScope(input.provider??{}).allowed,
  freshness:assessSessionFreshness(input.freshness??{}).available,
  provenance:assessReplayProvenance(input.provenance??{}).verified,
  database:assessDevDatabaseIsolation(input.database??{}).isolated,
  access:assessDualSurgeOwnerAccess(input.access??{}).allowed,
  statistics:assessDualSurgeSample({outcomes:input.outcomes??[],baselineOutcomes:input.baselineOutcomes??[]}).sufficient,
  forward:(()=>{try{const r=auditForwardOutcomes(input.forward??{});return r.status==="AUDITED"&&r.matured>0&&r.pending===0&&r.excluded===0;}catch{return false;}})()
 };
 const blocked=Object.entries(checks).filter(([,pass])=>!pass).map(([key])=>key);
 return {checks,blocked,allOfflineChecksPass:blocked.length===0,releaseApproved:false,productionApproved:false,readOnly:true};
}
