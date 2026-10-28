import test from "node:test";
import assert from "node:assert/strict";
import { classifyResearchDataUse as classify } from "../../app/lib/learning/classifyResearchDataUse.mjs";
const permissionEvidence="VERIFIED_DOCUMENTED_PERMISSION";
test("Yahoo automated research is denied despite claimed permission",()=>{
 const x=classify({provider:"YAHOO_CHART",purpose:"PROSPECTIVE_CAPTURE",delayWeeks:0,permissionEvidence});
 assert.equal(x.allowed,false);
 assert.equal(x.reason,"YAHOO_AUTOMATED_RESEARCH_NOT_AUTHORIZED");
});
test("free delayed data cannot be called current forward research",()=>{
 const x=classify({provider:"J-QUANTS",purpose:"FORWARD_OUTCOME",delayWeeks:12,permissionEvidence});
 assert.equal(x.allowed,false);
 assert.equal(x.reason,"DELAYED_DATA_NOT_PROSPECTIVE");
});
test("delayed history is classified as backtest only, not verified live accuracy",()=>{
 const x=classify({provider:"J-QUANTS",purpose:"HISTORICAL_BACKTEST",delayWeeks:12,permissionEvidence});
 assert.equal(x.allowed,true);
 assert.equal(x.verified,false);
 assert.equal(x.eligible_for_live_ai,false);
});
test("unverified permission always fails closed",()=>{
 const x=classify({provider:"J-QUANTS",purpose:"HISTORICAL_BACKTEST",delayWeeks:12});
 assert.equal(x.allowed,false);
 assert.equal(x.reason,"PROVIDER_PERMISSION_NOT_DOCUMENTED");
});
test("unknown delay fails closed",()=>{
 const x=classify({provider:"LICENSED_PROVIDER",purpose:"PROSPECTIVE_CAPTURE",permissionEvidence});
 assert.equal(x.reason,"UNKNOWN_DATA_DELAY");
});
