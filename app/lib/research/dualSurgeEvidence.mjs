// Research-only event identity and reproducibility checks. Caller supplies all data.
import {validateLedger} from "./dualSurgeQualityGates.mjs";
import {validIsoSessionDate} from "./dualSurgeCalendar.mjs";
export const EVIDENCE_VERSION="DUAL_SURGE_EVIDENCE_V1";
export function eventIdentity(event){
 if(!event||typeof event.code!=="string"||!/^[0-9]{4}$/.test(event.code)||typeof event.cohort!=="string"||!["PRE_SURGE_V1","SURGE_START_V1"].includes(event.cohort)||!validIsoSessionDate(event.startDate))throw Error("INVALID_EVENT_IDENTITY");
 return [event.code,event.cohort,event.startDate].join("|");
}
export function compareEventIdentities(reference,candidate){
 if(!Array.isArray(reference)||!Array.isArray(candidate))throw Error("INVALID_INPUT");
 const collect=events=>{const ids=new Set();for(const e of events){const id=eventIdentity(e);if(ids.has(id))throw Error("DUPLICATE_EVENT_IDENTITY");ids.add(id);}return ids;};
 const a=collect(reference),b=collect(candidate);
 const missing=[...a].filter(x=>!b.has(x)).sort();
 const unexpected=[...b].filter(x=>!a.has(x)).sort();
 return {referenceCount:a.size,candidateCount:b.size,missing,unexpected,identical:missing.length===0&&unexpected.length===0};
}
export function buildEvidenceGate({ledger,referenceEvents,sourceProvenance,ciVerified=false}){
 validateLedger(ledger);
 if(!Array.isArray(referenceEvents))throw Error("REFERENCE_EVENTS_REQUIRED");
 const identity=compareEventIdentities(referenceEvents,ledger);
 const provenance=Boolean(sourceProvenance&&typeof sourceProvenance.source==="string"&&sourceProvenance.source.trim()&&
  typeof sourceProvenance.snapshotId==="string"&&sourceProvenance.snapshotId.trim()&&sourceProvenance.licenseVerified===true);
 return {version:EVIDENCE_VERSION,identity,sourceProvenanceVerified:provenance,ciVerified:ciVerified===true,
  researchReproducible:identity.identical&&provenance&&ciVerified===true,
  productionApproved:false,
  warning:"Event identity alone does not establish price-field equivalence or performance validity."};
}
