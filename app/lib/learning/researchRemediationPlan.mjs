import { classifyResearchBlockers } from "./researchEvidenceBlockerReport.mjs";
// Research-only planning: never modifies observations, AI decisions or notifications.
const ORDER=["PROVENANCE","TEMPORAL","INTEGRITY","PAIRING","OUTCOME","INDEPENDENCE","REGIME","CONCENTRATION","COVERAGE","INPUT","OTHER"];
const GUIDE={
 PROVENANCE:"Obtain independent provider, licensing and immutable source evidence",
 TEMPORAL:"Prove bar end, signal generation and capture order without hindsight",
 INTEGRITY:"Reconcile identifiers, duplicates, inputs and stored observations",
 PAIRING:"Match baseline and SHADOW records by exact stock and trade date",
 OUTCOME:"Verify later-session prices, outcome dates and numeric returns",
 INDEPENDENCE:"Confirm independent baseline versus SHADOW methodology",
 REGIME:"Verify as-of market-regime classification and its source",
 CONCENTRATION:"Expand independent dates and stocks to reduce concentration",
 COVERAGE:"Accumulate prospective observations across different market sessions",
 INPUT:"Repair malformed evidence inputs before attempting a comparison",
 OTHER:"Manually review unclassified blockers; do not assume approval"
};
export function planResearchRemediation(pairs,options={}){
 const report=classifyResearchBlockers(pairs,options);
 const tasks=Object.entries(report.categories).filter(([,count])=>Number.isSafeInteger(count)&&count>0)
  .map(([category,count])=>({category,count,priority:ORDER.indexOf(category)<0?ORDER.length:ORDER.indexOf(category),action:GUIDE[category]??GUIDE.OTHER,requiresIndependentReview:true,autoApply:false}))
  .sort((a,b)=>a.priority-b.priority||b.count-a.count||a.category.localeCompare(b.category));
 return {status:"BLOCKED",autoApply:false,notificationsEnabled:false,checked:report.checked,truncated:report.truncated,tasks,blockerCounts:report.reasonCounts,samples:report.samples,replication:report.replication,
  adoption:{eligible:false,reason:"Independent provenance, legal-use proof, chronological out-of-sample replication and human approval not established"}};
}
