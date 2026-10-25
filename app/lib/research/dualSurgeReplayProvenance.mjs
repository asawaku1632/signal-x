// Offline provenance validation. Caller supplies hashes and trusted attestations.
// This does not hash raw data or establish provider licensing.
const SHA256=/^[a-f0-9]{64}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function validDate(value){if(typeof value!=="string"||!DATE.test(value))return false;const d=new Date(value+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
export function assessReplayProvenance({
 sourceId,sourceVersion,rawSha256,calculationVersion,asOfDate,signalDate,
 immutableSource=false,sourceAuthorized=false,replayMatched=false,
 outcomeStatus
}={}){
 const reasons=[];
 if(typeof sourceId!=="string"||!sourceId.trim())reasons.push("SOURCE_ID_MISSING");
 if(typeof sourceVersion!=="string"||!sourceVersion.trim())reasons.push("SOURCE_VERSION_MISSING");
 if(typeof rawSha256!=="string"||!SHA256.test(rawSha256))reasons.push("RAW_HASH_INVALID");
 if(typeof calculationVersion!=="string"||!calculationVersion.trim())reasons.push("CALCULATION_VERSION_MISSING");
 if(!validDate(asOfDate)||!validDate(signalDate)||asOfDate<signalDate)reasons.push("AS_OF_INVALID");
 if(immutableSource!==true)reasons.push("SOURCE_NOT_IMMUTABLE");
 if(sourceAuthorized!==true)reasons.push("SOURCE_NOT_AUTHORIZED");
 if(replayMatched!==true)reasons.push("REPLAY_UNVERIFIED");
 if(!["MATURED","PENDING"].includes(outcomeStatus))reasons.push("OUTCOME_STATUS_INVALID");
 if(outcomeStatus==="PENDING"&&replayMatched===true)reasons.push("PENDING_CANNOT_BE_VERIFIED_AS_MATURED");
 return {verified:reasons.length===0,reasons,readOnly:true,productionApproved:false};
}
