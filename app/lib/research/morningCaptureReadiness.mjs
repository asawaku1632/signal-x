/** Offline schema audit for prospective research; never authenticates caller claims. */
const requiredSnapshot=["experimentId","tradeDate","code","recordedAt","featureGeneratedAtUtc","quoteObservedAtUtc","barEndedAtUtc","provider","scoreVersion","sourceVerified","researchUseAllowed"];
const requiredOutcome=["experimentId","tradeDate","code","outcomeTradeDate","outcomeAvailableAt","outcomeSourceVerified","baselineReturn","candidateReturn"];
export function auditMorningCaptureReadiness({snapshots=[],outcomes=[]}={}){
 if(!Array.isArray(snapshots)||!Array.isArray(outcomes))throw Error("INVALID_CAPTURE_ROWS");
 const evaluate=(rows,required)=>({
  records:rows.length,
  complete:rows.filter(row=>row&&required.every(field=>row[field]!==null&&row[field]!==undefined&&row[field]!=="")).length,
  missingByField:Object.fromEntries(required.map(field=>[field,rows.filter(row=>!row||row[field]===null||row[field]===undefined||row[field]==="").length]))
 });
 const snapshot=evaluate(snapshots,requiredSnapshot),outcome=evaluate(outcomes,requiredOutcome);
 return {version:"MORNING_CAPTURE_READINESS_OFFLINE_V1",snapshot,outcome,
  schemaOnly:true,independentlyAuthenticated:false,decision:"DO_NOT_PROMOTE",
  collectionConfigured:false,productionChanged:false};
}
