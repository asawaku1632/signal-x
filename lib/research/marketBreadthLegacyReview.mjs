// Pure read-only legacy review. No inferred provider rights or historical prediction accuracy.
import {auditLegacySignalInventory} from './marketBreadthLegacyInventory.mjs';
import {auditLegacyOutcomeLinks} from './marketBreadthLegacyOutcomeAudit.mjs';
export function reviewMarketBreadthLegacyData(input={}){
 const inventory=auditLegacySignalInventory(input);
 const bb=auditLegacyOutcomeLinks(input.bbEvents??[],input.bbResults??[],{kind:'bb'});
 const technical=auditLegacyOutcomeLinks(input.technicalEvents??[],input.technicalResults??[],{kind:'technical'});
 const fiveDayLinkedUnverified=bb.counts.LINKED_UNVERIFIED+technical.counts.LINKED_UNVERIFIED;
 return {schemaVersion:'market-breadth-legacy-review-v1',
  researchOnly:true,productionEligible:false,notificationEligible:false,forwardEvidenceEligible:false,
  inventory,outcomes:{bb,technical},fiveDayLinkedUnverified,
  verifiedFiveDayOutcomes:0,verifiedProspectiveSignals:0,
  nextAction:'Require independent signal generation proof, market breadth provider rights and independently verified five-session prices before prospective research.'};
}
