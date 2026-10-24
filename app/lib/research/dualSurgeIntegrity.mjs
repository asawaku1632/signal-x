// Research-only aggregate invariants; no IO.
export function verifyAggregateArithmetic({events,matured,pending,excluded=0,positive,negative,flat=0}){
 const values=[events,matured,pending,excluded,positive,negative,flat];
 if(values.some(x=>!Number.isSafeInteger(x)||x<0))throw Error("INVALID_AGGREGATE");
 const statusBalanced=events===matured+pending+excluded;
 const directionBalanced=matured===positive+negative+flat;
 return {statusBalanced,directionBalanced,valid:statusBalanced&&directionBalanced};
}
export function checkBaselineManifest(manifest){
 if(!manifest||!manifest.eventCounts||!Number.isSafeInteger(manifest.selectedStocks)||!Number.isSafeInteger(manifest.detectorEligibleStocks))throw Error("INVALID_MANIFEST");
 const e=manifest.eventCounts;
 const arithmetic=verifyAggregateArithmetic({
  events:e.independentFirstEvents,matured:e.maturedFiveSession,pending:e.pendingFiveSession,
  positive:e.positiveFiveSession,negative:e.negativeFiveSession,flat:e.flatFiveSession??0
 });
 return {arithmetic,selectedStocks:manifest.selectedStocks,eligibleStocks:manifest.detectorEligibleStocks,
  eligibleNotMoreThanSelected:manifest.detectorEligibleStocks<=manifest.selectedStocks,
  perEventSourcePresent:Array.isArray(manifest.events)&&manifest.events.length===e.independentFirstEvents,
  evidenceComplete:false,
  warnings:["Aggregate arithmetic is not event-level reconciliation.","Do not infer unknown return buckets from totals."]};
}
export function compareDenominators(a,b){
 if(!a||!b||!Number.isSafeInteger(a.matured)||!Number.isSafeInteger(b.matured))throw Error("INVALID_DENOMINATOR");
 return {sameMatured:a.matured===b.matured,legacyMatured:a.matured,newMatured:b.matured,
  delta:b.matured-a.matured,comparable:a.matured===b.matured&&a.matured>0};
}
