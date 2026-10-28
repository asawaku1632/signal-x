import test from "node:test";
import assert from "node:assert/strict";
import { previewGeneratedScanResearchCapture as preview } from "../../app/lib/learning/previewGeneratedScanResearchCapture.mjs";
const now="2026-10-28T06:30:00.000Z";
const input={
 scanRunId:"research-run-1",tradeDate:"2026-10-28",
 scanStartedAt:"2026-10-28T06:29:00.000Z",scanCompletedAt:"2026-10-28T06:31:00.000Z",
 payload:{cached:false,updatedAt:now,stocks:[{
  code:"590A",price:1200,aiPower:80,
  latestBarTimestamp:Date.parse(now)/1000,
  dataSource:"unverified-demo",patternLearning:{rsiBand:"MID",trendKey:"UP"}
 }]}
};
test("generated Scan preview creates quarantined research row without saving",()=>{
 const original=structuredClone(input);
 const x=preview(input);
 assert.equal(x.accepted,true);
 assert.equal(x.attempted,1);
 assert.equal(x.rows[0].capture_status,"QUARANTINED");
 assert.equal(x.rows[0].audit_reason,"UNVERIFIED_FEATURE_ASOF_AND_PROVIDER");
 assert.equal(x.rows[0].code,"590A");
 assert.equal(x.persisted,false);
 assert.equal(x.live_ai_updated,false);
 assert.deepEqual(input,original);
});
test("cached payload is not previewable",()=>{
 const x=preview({...input,payload:{...input.payload,cached:true}});
 assert.equal(x.accepted,false);
 assert.equal(x.rows.length,0);
 assert.equal(x.persisted,false);
});
test("future bar cannot be treated as as-of",()=>{
 const future=Date.parse("2026-10-29T06:30:00Z")/1000;
 const x=preview({...input,payload:{...input.payload,stocks:[{...input.payload.stocks[0],latestBarTimestamp:future}]}});
 assert.equal(x.rows[0].capture_status,"QUARANTINED");
 assert.equal(x.rows[0].audit_reason,"FUTURE_SOURCE_BAR");
 assert.equal(x.rows[0].source_bar_at,null);
});
test("missing generated payload fails closed",()=>{
 const x=preview({...input,payload:{cached:false,updatedAt:now,stocks:[]}});
 assert.equal(x.accepted,false);
 assert.equal(x.rows.length,0);
});
