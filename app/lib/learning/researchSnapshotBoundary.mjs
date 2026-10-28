import {auditResearchIntegration} from "./researchIntegrationAudit.mjs";
// Pure snapshot boundary guard. Independent attestations cannot be inferred.
const iso=s=>typeof s==="string"&&Number.isFinite(Date.parse(s))&&/(?:Z|[+-]\d{2}:\d{2})$/.test(s);
export function inspectResearchSnapshotEnvelope(envelope){
 const errors=[];
 if(!envelope||typeof envelope!=="object"||Array.isArray(envelope))return {status:"BLOCKED",errors:["INVALID_ENVELOPE"],adoptable:false};
 if(!iso(envelope.snapshotAt))errors.push("INVALID_SNAPSHOT_TIME");
 if(!iso(envelope.queryStartedAt))errors.push("INVALID_QUERY_START");
 if(!iso(envelope.queryFinishedAt))errors.push("INVALID_QUERY_FINISH");
 if(iso(envelope.queryStartedAt)&&iso(envelope.queryFinishedAt)&&Date.parse(envelope.queryFinishedAt)<Date.parse(envelope.queryStartedAt))errors.push("NEGATIVE_QUERY_DURATION");
 if(iso(envelope.snapshotAt)&&iso(envelope.queryFinishedAt)&&Date.parse(envelope.snapshotAt)>Date.parse(envelope.queryFinishedAt))errors.push("SNAPSHOT_FROM_FUTURE");
 if(!Number.isSafeInteger(envelope.reportedTotal)||envelope.reportedTotal<0)errors.push("INVALID_REPORTED_TOTAL");
 if(!Number.isSafeInteger(envelope.rowsRead)||envelope.rowsRead<0)errors.push("INVALID_ROWS_READ");
 if(Number.isSafeInteger(envelope.reportedTotal)&&Number.isSafeInteger(envelope.rowsRead)&&envelope.rowsRead>envelope.reportedTotal)errors.push("ROWS_EXCEED_TOTAL");
 if(envelope.isComplete!==true)errors.push("INCOMPLETE_SNAPSHOT");
 if(envelope.sourceVerified!==true)errors.push("UNVERIFIED_SOURCE");
 if(envelope.licenseVerified!==true)errors.push("UNVERIFIED_LICENSE");
 if(typeof envelope.snapshotDigest!=="string"||envelope.snapshotDigest.length<32)errors.push("MISSING_IMMUTABLE_DIGEST");
 errors.push("INDEPENDENT_ATTESTATION_REQUIRED");
 return {status:"BLOCKED",errors,adoptable:false,completeDeclared:errors.every(x=>x!=="INCOMPLETE_SNAPSHOT")};
}
export function auditBoundedResearchSnapshot(envelope,aggregate,rows,evidence,options={}){
 const boundary=inspectResearchSnapshotEnvelope(envelope);
 const integration=auditResearchIntegration(aggregate,rows,evidence,options);
 const blockers=[...new Set([...boundary.errors,...integration.blockers])].sort();
 if(envelope&&Array.isArray(rows)&&Number.isSafeInteger(envelope.rowsRead)&&envelope.rowsRead!==rows.length)blockers.push("ROWS_READ_MISMATCH");
 if(envelope&&aggregate&&Number.isSafeInteger(envelope.reportedTotal)&&aggregate.total!==undefined&&Number(aggregate.total)!==envelope.reportedTotal)blockers.push("AGGREGATE_TOTAL_MISMATCH");
 return {status:"BLOCKED",adoptable:false,notificationAllowed:false,productionMutationAllowed:false,blockers:[...new Set(blockers)].sort(),reviewed:integration.reviewed};
}
