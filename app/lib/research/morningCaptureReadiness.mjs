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
 // Independently report value-shape defects; mere presence is never source authentication.
 const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
 const timestamp=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
 const count=(rows,field,valid)=>rows.filter(row=>row&&row[field]!==undefined&&row[field]!==null&&row[field]!==""&&!valid(row[field])).length;
 const malformed={
  snapshots:{tradeDate:count(snapshots,"tradeDate",date),recordedAt:count(snapshots,"recordedAt",timestamp),
   featureGeneratedAtUtc:count(snapshots,"featureGeneratedAtUtc",timestamp),
   quoteObservedAtUtc:count(snapshots,"quoteObservedAtUtc",timestamp),
   barEndedAtUtc:count(snapshots,"barEndedAtUtc",timestamp)},
  outcomes:{outcomeTradeDate:count(outcomes,"outcomeTradeDate",date),
   outcomeAvailableAt:count(outcomes,"outcomeAvailableAt",timestamp),
   baselineReturn:count(outcomes,"baselineReturn",x=>typeof x==="number"&&Number.isFinite(x)),
   candidateReturn:count(outcomes,"candidateReturn",x=>typeof x==="number"&&Number.isFinite(x))}
 };
 return {version:"MORNING_CAPTURE_READINESS_OFFLINE_V1",snapshot,outcome,malformed,
  schemaOnly:true,independentlyAuthenticated:false,decision:"DO_NOT_PROMOTE",
  collectionConfigured:false,productionChanged:false};
}
