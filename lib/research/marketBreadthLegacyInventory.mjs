// Read-only classification of legacy signal exports. No database access or mutation.
import {summarizeLegacySignalProvenance} from './marketBreadthLegacyProvenance.mjs';
export function auditLegacySignalInventory({bbEvents=[],technicalEvents=[],bbResults=[],technicalResults=[]}={}){
 if(![bbEvents,technicalEvents,bbResults,technicalResults].every(Array.isArray))throw new TypeError('INVALID_LEGACY_INVENTORY');
 const bb=summarizeLegacySignalProvenance(bbEvents,{kind:'bb'});
 const technical=summarizeLegacySignalProvenance(technicalEvents,{kind:'technical'});
 const resultCounts={bb:bbResults.length,technical:technicalResults.length};
 return {schemaVersion:'market-breadth-legacy-inventory-v1',researchOnly:true,productionEligible:false,
  forwardEvidenceEligible:false,signalCount:bb.total+technical.total,resultCount:resultCounts.bb+resultCounts.technical,
  sources:{bb,technical},resultCounts,
  blockers:['INDEPENDENT_SIGNAL_PROVENANCE_MISSING','LICENSED_MARKET_BREADTH_MISSING','VERIFIED_FIVE_SESSION_OUTCOMES_MISSING'],
  nextAction:'Recover immutable independent signal timestamps and licensed prospective market/outcome evidence. Do not infer performance from legacy rows.'};
}
