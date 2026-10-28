import test from "node:test";
import assert from "node:assert/strict";
import { buildGeneratedScanResearchEnvelope as build } from "../../app/lib/learning/buildGeneratedScanResearchEnvelope.mjs";
import { prepareScanFeatureCaptures } from "../../app/lib/learning/prepareScanFeatureCaptures.mjs";
const base={scanRunId:"r1",tradeDate:"2026-10-28",scanStartedAt:"2026-10-28T06:29:00Z",scanCompletedAt:"2026-10-28T06:35:00Z",
payload:{cached:false,updatedAt:"2026-10-28T06:34:00Z",stocks:[{code:"590A",price:1000,aiPower:75,latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000}]}};
test("freshly generated capture is still not verified and stays quarantined",()=>{
 const result=build(base); assert.equal(result.accepted,true);
 assert.equal(result.envelope.provenance_verified,false);
 assert.equal(result.envelope.provider_license_verified,false);
 const [row]=prepareScanFeatureCaptures(result.envelope);
 assert.equal(row.capture_status,"QUARANTINED");
 assert.equal(row.audit_reason,"UNVERIFIED_FEATURE_ASOF_AND_PROVIDER");
});
for(const [label,input,reason] of [
 ["cache",{payload:{...base.payload,cached:true}},"CACHED_NOT_GENERATED"],
 ["missing cache",{payload:{stocks:base.payload.stocks}},"CACHED_NOT_GENERATED"],
 ["empty",{payload:{...base.payload,stocks:[]}},"EMPTY_GENERATED_SCAN"],
 ["future update",{payload:{...base.payload,updatedAt:"2026-10-29T06:34:00Z"}},"UPDATED_AT_OUTSIDE_GENERATION"],
 ["bad window",{scanStartedAt:"2026-10-28T07:00:00Z"},"INVALID_GENERATION_WINDOW"],
 ["invalid date",{tradeDate:"2026-02-30"},"INVALID_RUN_IDENTITY"],
]) test(label,()=>assert.equal(build({...base,...input}).reason,reason));

test("missing generated timestamp is rejected",()=>{
 const result=build({...base,payload:{cached:false,stocks:base.payload.stocks}});
 assert.equal(result.accepted,false);
 assert.equal(result.reason,"UPDATED_AT_OUTSIDE_GENERATION");
});
test("missing input is rejected without throwing",()=>{
 assert.equal(build(null).reason,"INVALID_GENERATION_INPUT");
});
test("feature metadata is a snapshot, not a reference to mutable Scan objects",()=>{
 const stock={...base.payload.stocks[0],patternLearning:{rsiBand:"MID",trendKey:"UP"}};
 const result=build({...base,payload:{...base.payload,stocks:[stock]}});
 assert.equal(result.accepted,true);
 stock.patternLearning.rsiBand="OVERBOUGHT";
 assert.equal(result.envelope.scanResponse.stocks[0].patternLearning.rsiBand,"MID");
});
