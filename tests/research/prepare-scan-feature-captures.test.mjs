import test from "node:test";
import assert from "node:assert/strict";
import { prepareScanFeatureCaptures } from "../../app/lib/learning/prepareScanFeatureCaptures.mjs";
const base={scanRunId:"run1",tradeDate:"2026-10-27",scanReceivedAt:"2026-10-27T06:35:00Z"};
const stock={code:"9984",price:5000,aiPower:78,latestBarTimestamp:Date.parse("2026-10-27T06:30:00Z")/1000,patternLearning:{rsiBand:"MID",trendKey:"UP"}};
test("preserves Scan features but quarantines unproven as-of data",()=>{
 const [row]=prepareScanFeatureCaptures({...base,scanResponse:{stocks:[stock],cached:false}});
 assert.equal(row.capture_status,"QUARANTINED");assert.equal(row.audit_reason,"UNVERIFIED_FEATURE_ASOF_AND_PROVIDER");assert.equal(row.rsi_band,"MID");assert.equal(row.trend_key,"UP");
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

test("unknown cache state is quarantined",()=>{
 const [row]=prepareScanFeatureCaptures({...base,scanResponse:{stocks:[stock]}});
 assert.equal(row.capture_status,"QUARANTINED");
 assert.equal(row.audit_reason,"CACHED_SCAN");
});

test("future source bars are quarantined without violating database time check",()=>{
 const future=Date.parse("2026-10-28T06:30:00Z")/1000;
 const [row]=prepareScanFeatureCaptures({...base,scanResponse:{cached:false,stocks:[{...stock,latestBarTimestamp:future}]}});
 assert.equal(row.audit_reason,"FUTURE_SOURCE_BAR");
 assert.equal(row.source_bar_at,null);
 assert.equal(row.capture_status,"QUARANTINED");
});

test("actual Scan API cached fresh snapshot remains quarantined",()=>{
 const [row]=prepareScanFeatureCaptures({...base,scanResponse:{
  success:true,status:"fresh",cached:true,updatedAt:base.scanReceivedAt,stocks:[stock]
 }});
 assert.equal(row.capture_status,"QUARANTINED");
 assert.equal(row.audit_reason,"CACHED_SCAN");
});
test("loading Scan API response contains no research observations",()=>{
 const rows=prepareScanFeatureCaptures({...base,scanResponse:{
  success:true,status:"loading",cached:false,stocks:[]
 }});
 assert.deepEqual(rows,[]);
});

test("stale status cannot bypass quarantine with cached:false",()=>{
 const [row]=prepareScanFeatureCaptures({...base,scanResponse:{
  success:true,status:"stale",cached:false,stocks:[stock]
 }});
 assert.equal(row.audit_reason,"CACHED_SCAN");
});
