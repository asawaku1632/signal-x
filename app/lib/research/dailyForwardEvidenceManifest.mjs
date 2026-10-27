/**
 * Offline evidence manifest for proposed AI research changes.
 * No network, DB writes, production updates, or claims of provider licensing.
 * Every proposal must carry source provenance and reproducible dataset identity.
 */
export function attachForwardResearchEvidence(proposals, {
  datasetId, datasetSha256, sourceName, sourceVersion,
  sessionCalendarId, evaluationCommit, cutoffDate, reviewTimestamp,
  priceBasisReview = "NOT_VERIFIED", licenseReview = "NOT_VERIFIED",
} = {}) {
  if (!Array.isArray(proposals)) throw new TypeError("proposals must be an array");
  const required={datasetId,datasetSha256,sourceName,sourceVersion,sessionCalendarId,evaluationCommit,cutoffDate,reviewTimestamp};
  const missing=Object.entries(required).filter(([,v])=>typeof v!=="string"||!v.trim()).map(([k])=>k);
  const hashValid=typeof datasetSha256==="string"&&/^[a-f0-9]{64}$/i.test(datasetSha256);
  const evidenceStatus=missing.length===0&&hashValid?"TRACEABLE_METADATA_ONLY":"INCOMPLETE_METADATA";
  return proposals.map((proposal)=>({
    ...proposal,
    evidence:{
      datasetId:datasetId??null,
      datasetSha256:hashValid?datasetSha256.toLowerCase():null,
      sourceName:sourceName??null,
      sourceVersion:sourceVersion??null,
      sessionCalendarId:sessionCalendarId??null,
      evaluationCommit:evaluationCommit??null,
      cutoffDate:cutoffDate??null,
      reviewTimestamp:reviewTimestamp??null,
      priceBasisReview:priceBasisReview==="VERIFIED"?"VERIFIED":"NOT_VERIFIED",
      licenseReview:licenseReview==="VERIFIED"?"VERIFIED":"NOT_VERIFIED",
      status:evidenceStatus,
      missingFields:[...missing,...(!hashValid?["VALID_SHA256"]:[])],
    },
    readiness:"NOT_READY_FOR_PRODUCTION",
    approval:"NOT_REQUESTED",
    autoApply:false,
    productionWrites:false,
  }));
}
