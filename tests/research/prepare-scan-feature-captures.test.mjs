import test from "node:test";
import assert from "node:assert/strict";
import { prepareScanFeatureCaptures } from "../../app/lib/learning/prepareScanFeatureCaptures.mjs";
const base={scanRunId:"run1",tradeDate:"2026-10-27",scanReceivedAt:"2026-10-27T06:35:00Z"};
const stock={code:"9984",price:5000,aiPower:78,latestBarTimestamp:Date.parse("2026-10-27T06:30:00Z")/1000,patternLearning:{rsiBand:"MID",trendKey:"UP"}};
test("maps Scan stock into candidate with features",()=>{
 const [row]=prepareScanFeatureCaptures({...base,scanResponse:{stocks:[stock],cached:false}});
 assert.equal(row.capture_status,"ASOF_CANDIDATE");assert.equal(row.rsi_band,"MID");assert.equal(row.trend_key,"UP");
});
test("quarantines cached Scan",()=>{
 const [row]=prepareScanFeatureCaptures({...base,scanResponse:{stocks:[stock],cached:true}});
 assert.equal(row.capture_status,"QUARANTINED");assert.equal(row.audit_reason,"CACHED_SCAN");
});
test("quarantines missing bar timestamp",()=>{
 const [row]=prepareScanFeatureCaptures({...base,scanResponse:{stocks:[{...stock,latestBarTimestamp:null}]}});
 assert.equal(row.audit_reason,"MISSING_OR_INVALID_TIMESTAMP");
});
test("quarantines duplicate stock codes",()=>{
 const rows=prepareScanFeatureCaptures({...base,scanResponse:{stocks:[stock,stock]}});
 assert.equal(rows[1].audit_reason,"DUPLICATE_CODE");
});
