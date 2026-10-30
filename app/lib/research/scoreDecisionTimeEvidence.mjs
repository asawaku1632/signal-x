/** Pure metadata-only evidence gate. Timestamp without timezone and mutable score cannot prove ex-ante prediction. */
export function auditScoreDecisionTimeEvidence(row,{decisionTimeJst="09:05"}={}){
 if(!/^\d\d:\d\d$/.test(decisionTimeJst))throw Error("INVALID_DECISION_TIME");
 const created=typeof row?.created_at==="string"?row.created_at:null;
 const date=typeof row?.date==="string"?row.date:null;
 const syntactic=!!(created&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(created)&&date===created.slice(0,10));
 const claimedBefore=syntactic&&created.slice(11,16)<decisionTimeJst;
 return {date:date??null,createdAtWithoutZone:created,claimedBeforeLocalCutoff:claimedBefore,
  timestampZoneVerified:false,scoreImmutableHistoryVerified:false,sourceSnapshotVerified:false,
  exAnteScoreVerified:false,eligibleForModelTraining:false,eligibleForAlerts:false,
  reason:!syntactic?"INVALID_OR_MISMATCHED_CREATED_AT":!claimedBefore?"NOT_BEFORE_CUTOFF":"UNVERIFIED_TIMEZONE_AND_MUTABILITY"};
}
