// Offline research intake boundary. Does not fetch market data, write a DB, or infer proof.
import {runMarketBreadthForwardResearchPipeline} from './marketBreadthForwardResearchPipeline.mjs';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function intakeMarketBreadthForwardBundle(bundle,options={}){
 if(!bundle||typeof bundle!=='object'||Array.isArray(bundle)||bundle.schemaVersion!=='market-breadth-forward-bundle-v1'||!Array.isArray(bundle.entries))throw new Error('INVALID_FORWARD_BUNDLE');
 if(bundle.entries.length>100000)throw new Error('FORWARD_BUNDLE_TOO_LARGE');
 // Validate the structure before invoking any evidence checks; never trust metadata as attestation.
 const entries=bundle.entries.map(entry=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||!['envelope','sourceRecord','snapshotRecord','row','evidence'].every(key=>own(entry,key)))throw new Error('INVALID_FORWARD_BUNDLE_ENTRY');
  return entry;
 });
 const result=runMarketBreadthForwardResearchPipeline(entries,options);
 // Do not export raw prices, provider keys, or unverified source payloads.
 return {schemaVersion:'market-breadth-forward-intake-v1',researchOnly:true,productionEligible:false,notificationEligible:false,submittedCount:result.submittedCount,linkedCount:result.linkedCount,rejected:result.rejected,report:result.review.report,readiness:result.review.readiness,provenance:result.review.provenance};
}
