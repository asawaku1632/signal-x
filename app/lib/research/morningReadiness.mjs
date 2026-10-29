/** Read-only readiness inventory. Never infer OHLCV completeness from snapshots. */
export function assessMorningResearchReadiness(inventory){
  if(!inventory||typeof inventory!=="object"||Array.isArray(inventory))
    throw Error("INVALID_MORNING_READINESS_INVENTORY");
  const count=(key)=>{
    const n=inventory[key];
    if(!Number.isSafeInteger(n)||n<0)throw Error("INVALID_MORNING_READINESS_COUNT");
    return n;
  };
  const priorFeatureRows=count("priorFeatureRows");
  const fiveMinuteBarStockDays=count("fiveMinuteBarStockDays");
  const provenanceVerifiedStockDays=count("provenanceVerifiedStockDays");
  const joinedStockDays=count("joinedStockDays");
  const forwardEvaluatedStockDays=count("forwardEvaluatedStockDays");
  if(provenanceVerifiedStockDays>fiveMinuteBarStockDays||
     joinedStockDays>Math.min(priorFeatureRows,provenanceVerifiedStockDays)||
     forwardEvaluatedStockDays>joinedStockDays)
    throw Error("INCONSISTENT_MORNING_READINESS_COUNTS");
  return Object.freeze({
    version:"MORNING_RESEARCH_READINESS_V1",
    counts:{priorFeatureRows,fiveMinuteBarStockDays,provenanceVerifiedStockDays,joinedStockDays,forwardEvaluatedStockDays},
    blockers:[
      ...(priorFeatureRows===0?["NO_PRIOR_DAY_FEATURES"]:[]),
      ...(fiveMinuteBarStockDays===0?["NO_COMPLETE_FIVE_MINUTE_STOCK_DAYS"]:[]),
      ...(provenanceVerifiedStockDays===0?["NO_INDEPENDENT_SOURCE_VERIFICATION"]:[]),
      ...(joinedStockDays===0?["NO_AS_OF_JOINED_STOCK_DAYS"]:[]),
      ...(forwardEvaluatedStockDays===0?["NO_WALK_FORWARD_EVALUATIONS"]:[])
    ],
    researchReplayPossible:joinedStockDays>0,
    signalEnabled:false,
    readyForTrading:false,
    note:"Counts must come from independently audited exports; database snapshot counts are not five-minute OHLCV evidence."
  });
}
