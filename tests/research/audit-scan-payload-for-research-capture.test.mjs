import test from "node:test";
import assert from "node:assert/strict";
import { auditScanPayloadForResearchCapture as audit } from "../../app/lib/learning/auditScanPayloadForResearchCapture.mjs";
const stock={code:"590A",price:1200,aiPower:75,latestBarTimestamp:1793197800,dataSource:"intraday"};
test("complete fields are structural only, never licensed or independently verified",()=>{
 const x=audit({cached:false,stocks:[stock]});
 assert.equal(x.ready,true);
 assert.equal(x.reason,"STRUCTURE_ONLY_NOT_VERIFIED");
 assert.equal(x.independently_verified,false);
 assert.equal(x.source_license_verified,false);
});
test("missing timestamp and source are counted",()=>{
 const x=audit({cached:false,stocks:[{...stock,latestBarTimestamp:null,dataSource:null}]});
 assert.equal(x.ready,false);
 assert.equal(x.missing.latestBarTimestamp,1);
 assert.equal(x.missing.dataSource,1);
});
test("cached and missing payloads are blocked",()=>{
 assert.equal(audit({cached:true,stocks:[stock]}).ready,false);
 assert.equal(audit(null).reason,"INVALID_SCAN_PAYLOAD");
});

test("present but invalid numerical fields are not accepted as capture-ready",()=>{
 const x=audit({cached:false,stocks:[{...stock,price:0,aiPower:101,latestBarTimestamp:-1}]});
 assert.equal(x.ready,false);
 assert.equal(x.missing.invalidPrice,1);
 assert.equal(x.missing.invalidAiPower,1);
 assert.equal(x.missing.invalidBarTimestamp,1);
});
test("malformed stock identifiers are counted as structural failures",()=>{
 const x=audit({cached:false,stocks:[{...stock,code:"INVALID"}]});
 assert.equal(x.ready,false);
 assert.equal(x.missing.invalidCode,1);
});
