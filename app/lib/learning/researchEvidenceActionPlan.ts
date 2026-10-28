import {classifyResearchEvidence,type ResearchEvidenceRow} from "@/app/lib/learning/researchEvidenceClassification";
// Review-only action plan. Never treat a self-reported proof as independent verification.
export const RESEARCH_EVIDENCE_REQUIREMENTS=[
 {code:"OUTCOME_PENDING",label:"5日後の結果",next:"独立した取引日カレンダーと確定結果を照合"},
 {code:"SOURCE_UNVERIFIED",label:"価格の出典",next:"提供元・取得経路と利用権限の証跡を確認"},
 {code:"LICENSE_UNVERIFIED",label:"利用許諾",next:"商用再利用と保存の許諾を法的に確認"},
 {code:"TIMESTAMP_UNVERIFIED",label:"判定発生時刻",next:"独立時刻を信頼できるログで立証"},
 {code:"FORWARD_UNVERIFIED",label:"将来方向の検証",next:"事後的な銘柄選定を除くFORWARD標本を検証"},
 {code:"SAMPLE_NOT_EXHAUSTIVE",label:"網羅性",next:"限定標本以外の観測も対象にし完全性を証明"}
] as const;
export function planResearchEvidenceActions(row:ResearchEvidenceRow){
 const classified=classifyResearchEvidence(row);
 const actions=classified.reasons.map(code=>{
  const matched=RESEARCH_EVIDENCE_REQUIREMENTS.find(x=>x.code===code);
  return {code,label:matched?.label??"異常・未定義の証拠",next:matched?.next??"管理者が根拠を調査し、独立した証拠で確認"};
 });
 return {state:classified.state,actions,needsIndependentVerification:actions.length>0,
  eligibleForAdoption:false as const,notificationEnabled:false as const,productionApplied:false as const};
}
export function summarizeEvidenceActions(rows:ResearchEvidenceRow[]){
 if(rows.length>1000)throw Error("EVIDENCE_ACTION_LIMIT");
 const counts:Record<string,number>={};
 for(const row of rows)for(const action of planResearchEvidenceActions(row).actions)counts[action.code]=(counts[action.code]??0)+1;
 return {inspected:rows.length,counts,allRequirementsIndependentlyAttested:false as const,adoptionApproved:false as const};
}
