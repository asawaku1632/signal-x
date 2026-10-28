import test from "node:test";
import assert from "node:assert/strict";
import { planScanResearchIntake as plan } from "../../app/lib/learning/planScanResearchIntake.mjs";
const started="2026-10-28T06:29:00Z";
const completed="2026-10-28T06:35:00Z";
const payload={cached:false,updatedAt:"2026-10-28T06:34:00Z",stocks:[
 {code:"590A",price:1000,aiPower:70,latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000},
 {code:"641A",price:1200,aiPower:65,latestBarTimestamp:null},
 {code:"590A",price:1000,aiPower:70,latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000}
]};
const input={scanRunId:"plan-1",tradeDate:"2026-10-28",scanStartedAt:started,scanCompletedAt:completed,payload};
test("intake isolates eligible as-of candidates but never verifies them",()=>{
 const before=structuredClone(input);
 const x=plan(input);
 assert.equal(x.accepted,true);
 assert.equal(x.valid_for_storage,true);
 assert.equal(x.candidate_count,1);
 assert.equal(x.blocked_count,2);
 assert.equal(x.blocked_reasons.MISSING_OR_INVALID_TIMESTAMP,1);
 assert.equal(x.blocked_reasons.DUPLICATE_CODE,1);
 assert.equal(x.rows[0].capture_status,"QUARANTINED");
 assert.equal(x.requires_independent_evidence,true);
 assert.equal(x.ai_power_recalculated,false);
 assert.equal(x.live_notification_enabled,false);
 assert.deepEqual(input,before);
});
test("cached display snapshot is not accepted as generated observation",()=>{
 const x=plan({...input,payload:{...payload,cached:true}});
 assert.equal(x.accepted,false);
 assert.equal(x.valid_for_storage,false);
 assert.deepEqual(x.rows,[]);
});
test("missing bar timestamps cannot turn into verified samples",()=>{
 const x=plan({...input,payload:{...payload,stocks:[payload.stocks[1]]}});
 assert.equal(x.accepted,true);
 assert.equal(x.valid_for_storage,false);
 assert.equal(x.candidate_count,0);
 assert.equal(x.blocked_count,1);
});
test("future bars are excluded from intake",()=>{
 const future=Date.parse("2026-10-29T06:30:00Z")/1000;
 const x=plan({...input,payload:{...payload,stocks:[{...payload.stocks[0],latestBarTimestamp:future}]}});
 assert.equal(x.valid_for_storage,false);
 assert.equal(x.blocked_count,1);
});
