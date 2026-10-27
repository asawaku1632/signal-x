// Research-only approval assessment. Pure calculation: NO production writes,
// no AI POWER mutation, no delivery, no trading instructions.
// This module is not imported by trading or notification execution paths.
export type EvidenceSnapshot = {
  researchId: string;
  ruleVersion: string;
  recorded: number;
  evaluated: number;
  distinctTradeDays: number;
  completedMonths: number;
  avgReturn5d: number | null;
  medianReturn5d: number | null;
  positiveRate5d: number | null; // 0..1
  marketRegimes: Array<{name:string; evaluated:number; avgReturn5d:number|null}>;
  sourceVerified: boolean;
  licenseVerified: boolean;
  independentTimestampsVerified: boolean;
  holdoutVerified: boolean;
};
export type ReviewDecision = "PENDING"|"REJECTED"|"APPROVED_FOR_REVIEW";
export type ReviewRecord = {
  researchId:string;
  evidenceDigest:string;
  reviewer:string;
  decision:ReviewDecision;
  reviewedAt:string;
  rationale:string;
};
const finite=(n:number|null):n is number=>n!==null&&Number.isFinite(n);
export function assessResearchEvidence(e:EvidenceSnapshot){
  const reasons:string[]=[];
  if(!e.researchId||!e.ruleVersion) reasons.push("MISSING_RESEARCH_ID_OR_RULE");
  if(!e.sourceVerified||!e.licenseVerified||!e.independentTimestampsVerified)
    reasons.push("UNVERIFIED_SOURCE_LICENSE_OR_TIME");
  if(!e.holdoutVerified) reasons.push("MISSING_INDEPENDENT_HOLDOUT");
  if(!Number.isInteger(e.recorded)||!Number.isInteger(e.evaluated)||e.recorded<0||e.evaluated<0||e.evaluated>e.recorded)
    reasons.push("INVALID_COUNTS");
  if(e.evaluated<100||e.distinctTradeDays<20||e.completedMonths<3)
    reasons.push("INSUFFICIENT_OBSERVATION_WINDOW");
  if(!finite(e.avgReturn5d)||!finite(e.medianReturn5d)||!finite(e.positiveRate5d)||
    e.positiveRate5d<0||e.positiveRate5d>1)
    reasons.push("MISSING_OR_INVALID_METRICS");
  if(e.marketRegimes.length<2||e.marketRegimes.some(r=>!r.name||r.evaluated<20||!finite(r.avgReturn5d)))
    reasons.push("INSUFFICIENT_REGIME_EVIDENCE");
  return {eligibleForHumanReview:reasons.length===0,reasons,
    // Never imply statistical or investment validation from sample-size gates.
    status:reasons.length===0?"REVIEW_CANDIDATE":"BLOCKED",
    automaticActivation:false as const};
}
export function auditReview(e:EvidenceSnapshot, digest:string, review:ReviewRecord|null){
  const evidence=assessResearchEvidence(e);
  const issues=[...evidence.reasons];
  if(!digest||!/^[a-f0-9]{64}$/.test(digest)) issues.push("INVALID_EVIDENCE_DIGEST");
  if(!review) issues.push("MISSING_HUMAN_REVIEW");
  else{
    if(review.researchId!==e.researchId||review.evidenceDigest!==digest)
      issues.push("REVIEW_EVIDENCE_MISMATCH");
    if(review.decision!=="APPROVED_FOR_REVIEW"||!review.reviewer.trim()||
      !review.rationale.trim()||!Number.isFinite(Date.parse(review.reviewedAt)))
      issues.push("REVIEW_NOT_APPROVED");
  }
  return {reviewRecorded:review!==null,readyForSeparateReleaseReview:issues.length===0,
    issues,productionApplied:false as const,notificationEnabled:false as const,
    tradingLogicChanged:false as const};
}
