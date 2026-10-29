// Offline, read-only review of externally verified evidence bundles.
// This function cannot establish provider rights or independent provenance.
// Those must be attested outside this process before evidence is supplied.
import {runMarketBreadthResearchReview} from './marketBreadthReviewPipeline.mjs';
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
export function reviewMarketBreadthOfflineBundle(bundle,{generatedAt}={}){
 if(!bundle||bundle.schemaVersion!=='market-breadth-offline-bundle-v1'||
    !Array.isArray(bundle.entries))throw new Error('INVALID_OFFLINE_BUNDLE');
 if(bundle.entries.length>100000)throw new Error('OFFLINE_BUNDLE_TOO_LARGE');
 const rows=[],byRow=new WeakMap();
 for(const entry of bundle.entries){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||
     !entry.row||typeof entry.row!=='object'||Array.isArray(entry.row)||
     !own(entry,'evidence'))throw new Error('INVALID_OFFLINE_ENTRY');
  rows.push(entry.row);
  byRow.set(entry.row,entry.evidence);
 }
 const result=runMarketBreadthResearchReview(rows,row=>byRow.get(row),{generatedAt});
 // No raw evidence objects or provider secrets in exported summary.
 return {schemaVersion:'market-breadth-offline-review-v1',
  researchOnly:true,productionEligible:false,notificationEligible:false,
  inputCount:rows.length,report:result.report,readiness:result.readiness,
  provenance:result.provenance,
  rejected:result.audit.rejected.map(x=>({...x}))};
}
