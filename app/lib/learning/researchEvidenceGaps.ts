import type { EvidenceSnapshot } from "@/app/lib/learning/researchApprovalGate";
import { assessResearchEvidence } from "@/app/lib/learning/researchApprovalGate";
export type GapCategory="PROVENANCE"|"INDEPENDENCE"|"SAMPLE"|"METRICS"|"REGIME";
export type EvidenceGap={category:GapCategory;code:string;label:string;nextAction:string};
export function classifyResearchEvidenceGaps(e:EvidenceSnapshot):EvidenceGap[]{
 const gaps:EvidenceGap[]=[];
 const add=(category:GapCategory,code:string,label:string,nextAction:string)=>gaps.push({category,code,label,nextAction});
 if(!e.sourceVerified)add("PROVENANCE","SOURCE","データ提供元が未検証","提供元と取得経路の証拠を確認する");
 if(!e.licenseVerified)add("PROVENANCE","LICENSE","利用許諾が未検証","商用利用条件と許諾根拠を確認する");
 if(!e.independentTimestampsVerified)add("PROVENANCE","TIMESTAMP","判定時刻が未検証","独立した生成時刻と株価時刻を照合する");
 if(!e.holdoutVerified)add("INDEPENDENCE","HOLDOUT","独立期間での再現性が未検証","将来期間を固定したアウトオブサンプル結果を確認する");
 if(!Number.isInteger(e.recorded)||!Number.isInteger(e.evaluated)||e.recorded<0||e.evaluated<0||e.evaluated>e.recorded)add("SAMPLE","COUNTS","保存・検証件数の整合性に問題","原データと判定済み件数を照合する");
 if(e.evaluated<100||e.distinctTradeDays<20||e.completedMonths<3)add("SAMPLE","WINDOW","検証件数・日数・月数が不足","判定済み100件・20取引日・完成済み3か月を確認する（暫定目安）");
 if(e.avgReturn5d===null||!Number.isFinite(e.avgReturn5d)||e.medianReturn5d===null||!Number.isFinite(e.medianReturn5d)||e.positiveRate5d===null||!Number.isFinite(e.positiveRate5d)||e.positiveRate5d<0||e.positiveRate5d>1)add("METRICS","FIVE_DAY","5日後の集計指標が不足・不正","平均・中央値・プラス率の再計算と照合を行う");
 if(e.marketRegimes.length<2||e.marketRegimes.some(x=>!x.name||x.evaluated<20||x.avgReturn5d===null||!Number.isFinite(x.avgReturn5d)))add("REGIME","REGIMES","相場環境ごとの再現性が不足","相場区分別に十分な検証済み事例を集める");
 return gaps;
}
export function buildResearchReviewReadiness(e:EvidenceSnapshot){
 const gate=assessResearchEvidence(e);
 const gaps=classifyResearchEvidenceGaps(e);
 // Explicitly fail closed if this detailed gate differs from the main review gate.
 return {status:gate.eligibleForHumanReview&&gaps.length===0?"REVIEW_CANDIDATE":"BLOCKED",
   gaps,mainGateReasons:gate.reasons,consistent:(gaps.length===0)===gate.eligibleForHumanReview,
   approvalRecorded:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
