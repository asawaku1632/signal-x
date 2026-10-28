import { inspectEvidencePair } from "./researchIndependentPairAudit.mjs";
import { summarizeReplicationEvidence } from "./researchReplicationEvidence.mjs";
// Owner review only. This report cannot approve, rank or notify trading opportunities.
const categories=Object.freeze({
 INVALID_ROW:"INPUT",INVALID_PAIRS:"INPUT",INVALID_OR_DUPLICATE_PAIRS:"INTEGRITY",
 MISSING_BASELINE:"PAIRING",MISSING_SHADOW:"PAIRING",MISSING_REGIME:"REGIME",
 PAIR_INVALID_RETURN:"OUTCOME",PAIR_OUTCOME_DATE_MISMATCH:"OUTCOME",
 PAIR_NOT_INDEPENDENT_VARIANT:"INDEPENDENCE",PAIR_SHARED_SOURCE_REQUIRES_REVIEW:"INDEPENDENCE",
 INSUFFICIENT_PAIRS:"COVERAGE",INSUFFICIENT_DAYS:"COVERAGE",INSUFFICIENT_STOCKS:"COVERAGE",
 INSUFFICIENT_REGIMES:"REGIME",EXCESSIVE_CONCENTRATION:"CONCENTRATION",
 INDEPENDENT_ATTESTATION_REQUIRED:"PROVENANCE",
 INDEPENDENT_PROVENANCE_AND_OUT_OF_SAMPLE_REVIEW_REQUIRED:"PROVENANCE"
});
function category(reason){
 if(categories[reason])return categories[reason];
 if(/PROVIDER|LICENSE|DIGEST|SOURCE|ATTESTATION/.test(reason))return "PROVENANCE";
 if(/LOOKAHEAD|AFTER_CAPTURE|TIMESTAMP|SIGNAL_TIME|BAR_END/.test(reason))return "TEMPORAL";
 if(/REGIME/.test(reason))return "REGIME";
 if(/BASELINE|SHADOW|PAIR|ORPHAN/.test(reason))return "PAIRING";
 if(/RETURN|OUTCOME/.test(reason))return "OUTCOME";
 if(/DATE|CODE|PRICE|POWER|DUPLICATE|KEY/.test(reason))return "INTEGRITY";
 return "OTHER";
}
export function classifyResearchBlockers(pairs,{limit=500,detailLimit=10}={}){
 if(!Array.isArray(pairs))return {status:"BLOCKED",checked:0,truncated:false,reasonCounts:{INVALID_PAIRS:1},categories:{INPUT:1},samples:[]};
 const bound=Number.isSafeInteger(limit)&&limit>0?Math.min(limit,1000):500;
 const cap=Number.isSafeInteger(detailLimit)&&detailLimit>=0?Math.min(detailLimit,50):10;
 const counts={}, samples=[];
 const add=(code)=>{counts[code]=(counts[code]||0)+1};
 for(let i=0;i<Math.min(pairs.length,bound);i++){
  const p=pairs[i],r=inspectEvidencePair(p?.observation,p?.baseline,p?.shadow,p?.regime);
  for(const issue of r.issues)add(issue);
  if(samples.length<cap) samples.push({index:i,code:typeof p?.observation?.code==="string"?p.observation.code:null,tradeDate:typeof p?.observation?.trade_date==="string"?p.observation.trade_date:null,reasons:r.issues.slice(0,30)});
 }
 const replication=summarizeReplicationEvidence(pairs.slice(0,bound));
 for(const code of replication.blockers)add(code);
 const truncated=pairs.length>bound;
 if(truncated)add("TRUNCATED_REVIEW");
 const groups={};
 for(const [reason,n] of Object.entries(counts)){const c=category(reason);groups[c]=(groups[c]||0)+n}
 return {status:"BLOCKED",checked:Math.min(pairs.length,bound),truncated,reasonCounts:counts,categories:groups,samples,replication:{status:"BLOCKED",sampleSize:replication.sampleSize,distinctDays:replication.distinctDays,distinctStocks:replication.distinctStocks,distinctRegimes:replication.distinctRegimes,blockers:replication.blockers}};
}
