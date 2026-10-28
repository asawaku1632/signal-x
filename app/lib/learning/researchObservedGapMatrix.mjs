import { inspectActualStoredObservation } from "./researchActualStoredReadiness.mjs";
// Pure diagnostic only. Never creates missing evidence or authorizes AI promotion.
const dimensions=[
 ["PROVENANCE",["INDEPENDENT_PROVIDER_LICENSE_PROOF_ABSENT","SIGNAL_BAR_PROVENANCE_ABSENT"]],
 ["PAIRING",["BASELINE_SHADOW_PAIR_ABSENT"]],
 ["REGIME",["MARKET_REGIME_PROVENANCE_ABSENT"]],
 ["REPLICATION",["OUT_OF_SAMPLE_REPLICATION_NOT_ATTESTED"]],
 ["OUTCOME",["PENDING_FIVE_DAY_OUTCOME","INVALID_FIVE_DAY_OUTCOME","MISSING_FIVE_DAY_DATE","INVALID_FIVE_DAY_DATE"]],
 ["INTEGRITY",["INVALID_ROW","INVALID_TRADE_DATE","INVALID_CODE","INVALID_ENTRY","INVALID_AI_POWER","INVALID_CAPTURE_TIME","MISSING_RULE_VERSION"]]
];
export function inspectStoredGapMatrix(rows,{limit=1000,sampleLimit=5}={}){
 if(!Array.isArray(rows))return {status:"BLOCKED",checked:0,truncated:false,dimensions:[],samples:[],reasonCounts:{INVALID_BATCH:1},eligible:false};
 const cap=Number.isSafeInteger(limit)&&limit>0?Math.min(limit,1000):1000;
 const sampleCap=Number.isSafeInteger(sampleLimit)&&sampleLimit>=0?Math.min(sampleLimit,20):5;
 const counts={},samples=[],keys=new Set();
 for(let i=0;i<Math.min(rows.length,cap);i++){
  const item=inspectActualStoredObservation(rows[i]);
  for(const reason of item.reasons) counts[reason]=(counts[reason]||0)+1;
  if(item.observationKey){if(keys.has(item.observationKey))counts.DUPLICATE_OBSERVATION=(counts.DUPLICATE_OBSERVATION||0)+1;keys.add(item.observationKey)}
  if(samples.length<sampleCap)samples.push({index:i,key:item.observationKey,hasFiveDayOutcome:item.hasFiveDayOutcome,reasons:item.reasons.slice(0,20)});
 }
 const truncated=rows.length>cap;
 if(truncated)counts.TRUNCATED_READ=1;
 const matrix=dimensions.map(([dimension,codes])=>({dimension,affected:Math.max(0,...codes.map(c=>counts[c]||0)),reasons:codes.filter(c=>counts[c]>0).map(code=>({code,count:counts[code]})),actionRequired:true}));
 return {status:"BLOCKED",eligible:false,checked:Math.min(rows.length,cap),truncated,dimensions:matrix,reasonCounts:counts,samples,conclusion:"Research evidence cannot be adopted until independent provenance, aligned comparison cohorts, and forward validation are externally established."};
}
