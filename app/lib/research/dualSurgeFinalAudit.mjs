// Aggregates independent offline checks. A passing fixture is never a deployment approval.
import {evaluateReadiness} from "./dualSurgeReadiness.mjs";
import {assessProviderScope} from "./dualSurgeProviderScope.mjs";
import {assessSessionFreshness} from "./dualSurgeSessionFreshness.mjs";
import {assessReplayProvenance} from "./dualSurgeReplayProvenance.mjs";
import {assessDevDatabaseIsolation} from "./dualSurgeDevDatabaseGuard.mjs";
import {assessDualSurgeOwnerAccess} from "./dualSurgeOwnerAccess.mjs";
import {assessDualSurgeSample} from "./dualSurgeStatisticalAudit.mjs";
import {auditForwardOutcomes,HORIZONS} from "./dualSurgeForwardAudit.mjs";
export function auditDualSurgeRelease(input={}){
 if(!input||typeof input!=="object"||Array.isArray(input))input={};
 const check=(fn)=>{try{return fn()===true;}catch{return false;}};
 const checks={
  evidence:check(()=>evaluateReadiness(input.evidence??{}).verified),
  provider:check(()=>assessProviderScope(input.provider??{}).allowed),
  freshness:check(()=>assessSessionFreshness(input.freshness??{}).available),
  provenance:check(()=>assessReplayProvenance(input.provenance??{}).verified),
  database:check(()=>assessDevDatabaseIsolation(input.database??{}).isolated),
  access:check(()=>assessDualSurgeOwnerAccess(input.access??{}).allowed),
  statistics:check(()=>assessDualSurgeSample({outcomes:input.outcomes??[],baselineOutcomes:input.baselineOutcomes??[]}).sufficient),
  forward:(()=>{try{const r=auditForwardOutcomes(input.forward??{});return r.status==="AUDITED"&&r.outcomes.length===HORIZONS.length&&HORIZONS.every(h=>r.outcomes.some(x=>x.horizon===h&&x.status==="MATURED"))&&r.pending===0&&r.excluded===0;}catch{return false;}})()
 };
 const blocked=Object.entries(checks).filter(([,pass])=>!pass).map(([key])=>key);
 return {checks,blocked,allOfflineChecksPass:blocked.length===0,releaseApproved:false,productionApproved:false,readOnly:true};
}
