import test from "node:test";
import assert from "node:assert/strict";
import {verifiedReplayDisplay} from "../../app/lib/research/dualSurgeVerifiedDisplay.mjs";
const evidence={licenseVerified:true,independentReplayVerified:true,snapshotId:"licensed-offline-fixture",commitSha:"a".repeat(40)};
const report={productionApproved:false,providerRequests:0,readOnly:true,allMatched:true,eventCount:2,
 results:[{status:"MATURED",matches:true,calculatedReturnPct:3},{status:"PENDING",matches:true,calculatedReturnPct:null}],
 summary:{total:2,matched:2,unverified:0,pending:1,maturedPositive:1,maturedNegative:0,maturedFlat:0,excluded:0,missing:0,mismatched:0}};
test("display remains blocked when evidence is absent",()=>{
 assert.equal(verifiedReplayDisplay({report}).available,false);
});
test("display permits only explicitly evidenced offline replay",()=>{
 const r=verifiedReplayDisplay({report,evidence});
 assert.equal(r.available,true);
 assert.deepEqual(r.summary,{total:2,positive:1,negative:0,flat:0,pending:1});
});
test("pending cases cannot be counted as matured",()=>{
 const invalid={...report,summary:{...report.summary,maturedPositive:2,pending:1}};
 assert.equal(verifiedReplayDisplay({report:invalid,evidence}).available,false);
});
test("unverified or missing events prevent display",()=>{
 assert.equal(verifiedReplayDisplay({report:{...report,summary:{...report.summary,unverified:1}},evidence}).available,false);
 assert.equal(verifiedReplayDisplay({report:{...report,eventCount:0,results:[]},evidence}).available,false);
});
test("display rejects unlicensed or production-approved reports",()=>{
 assert.equal(verifiedReplayDisplay({report,evidence:{...evidence,licenseVerified:false}}).available,false);
 assert.equal(verifiedReplayDisplay({report:{...report,productionApproved:true},evidence}).available,false);
});
