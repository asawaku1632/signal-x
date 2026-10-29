/** Offline timing gate for saved scores. DB timestamp WITHOUT TIME ZONE is not proof of as-of existence. */
const explicit=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
export function auditScoreDecisionTime(row,{decisionTime}={}){
 const t=row?.createdAt, checked=row?.checkedAt;
 if(!explicit(decisionTime))return {eligible:false,reason:"INVALID_DECISION_INSTANT",exAnteVerified:false};
 if(!explicit(t))return {eligible:false,reason:"UNVERIFIED_CREATED_AT_TIMEZONE",exAnteVerified:false};
 if(Date.parse(t)>Date.parse(decisionTime))return {eligible:false,reason:"CREATED_AFTER_DECISION",exAnteVerified:false};
 if(checked!==undefined&&checked!==null&&(!explicit(checked)||Date.parse(checked)<Date.parse(t)))
  return {eligible:false,reason:"INVALID_OUTCOME_CHECK_TIME",exAnteVerified:false};
 return {eligible:false,reason:"EXTERNAL_ORIGIN_AND_IMMUTABILITY_UNVERIFIED",timeOrderPlausible:true,exAnteVerified:false};
}
