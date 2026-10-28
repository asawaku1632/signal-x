import {crossAuditResearchAdoption} from "@/app/lib/learning/researchCrossAudit";
import type {EvidenceSnapshot} from "@/app/lib/learning/researchApprovalGate";
// No trust escalation: the current read-only report has no independently
// attested rights, holdout, reviewer signature or exhaustive history.
export function summarizeFinalResearchReadiness(e:EvidenceSnapshot,entries:Array<{valid:boolean}>,historyTruncated:boolean,previousGateBlocked:boolean){
 const audited=crossAuditResearchAdoption({
  researchId:e.researchId,ruleVersion:e.ruleVersion,
  reviewResearchId:e.researchId,reviewRuleVersion:e.ruleVersion,
  recorded:e.recorded,evaluated:e.evaluated,
  validEvidenceRows:entries.filter(x=>x.valid).length,
  invalidEvidenceRows:entries.filter(x=>!x.valid).length,
  historyTruncated,historyComplete:false,
  independentProvenanceVerified:false,licenseVerified:false,
  holdoutVerified:false,regimeVerified:false,
  reviewerApproved:false,reviewDigestMatches:false,approvalStillValid:false,
  previousGateBlocked,notificationEnabled:false,productionApplied:false
 });
 return {...audited,verificationSource:"UNATTESTED_READ_ONLY_REPORT" as const,
  reviewStatus:"HUMAN_REVIEW_NOT_COMPLETED" as const};
}
