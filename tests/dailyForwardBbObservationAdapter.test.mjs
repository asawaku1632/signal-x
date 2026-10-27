import test from "node:test";
import assert from "node:assert/strict";
import { inspectBbForwardResearchRows } from "../app/lib/research/dailyForwardBbObservationAdapter.mjs";
const row={event_id:"event-1",code:"9432",observation_date:"2026-08-21",
 horizon:5,horizon_unit:"TRADING_DAY",result_quality:"COMPLETE",has_return:true,
 provider:"YAHOO_CHART"};
test("Yahoo five-day BB outcomes remain excluded",()=>{
 const result=inspectBbForwardResearchRows([row]);
 assert.equal(result.candidateCount,0);
 assert.equal(result.reasonCounts.PRICE_OR_LICENSE_NOT_INDEPENDENTLY_VERIFIED,1);
 assert.equal(result.productionWrites,false);
});
test("one and three day BB outcomes are excluded",()=>{
 const result=inspectBbForwardResearchRows([{...row,horizon:1},{...row,horizon:3}]);
 assert.equal(result.reasonCounts.OUTSIDE_FIVE_DAY_HORIZON,2);
});
test("even independently reviewed BB observations are not AI experiment predictions",()=>{
 const result=inspectBbForwardResearchRows([{
 ...row,provider:"JQUANTS_V2",independentPriceEvidenceVerified:true,licenseReview:"VERIFIED",
 }]);
 assert.equal(result.candidateCount,1);
 assert.equal(result.status,"RESEARCH_ONLY_NOT_ELIGIBLE_FOR_AI_EXPERIMENT");
 assert.equal(result.diagnostic.status,"NOT_READY");
});
test("duplicate events and invalid exports fail closed",()=>{
 const reviewed={...row,provider:"JQUANTS_V2",independentPriceEvidenceVerified:true,licenseReview:"VERIFIED"};
 assert.equal(inspectBbForwardResearchRows([reviewed,reviewed]).reasonCounts.DUPLICATE_EVENT_HORIZON,1);
 assert.equal(inspectBbForwardResearchRows(null).status,"BLOCKED");
});
