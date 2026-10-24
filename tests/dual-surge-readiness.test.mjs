import test from "node:test";
import assert from "node:assert/strict";
import {assessDualSurgeSourceReadiness} from "../app/lib/research/dualSurgeReadiness.mjs";
import {prepareDualSurgeCandidates} from "../app/lib/research/dualSurgePersistence.mjs";

const date="2026-10-23";
const sample={code:"3762",provider:"TEST_FIXTURE",licenseStatus:"APPROVED",sourceVerified:true,completedDate:date,signalDate:date,calendarVersion:"test-v1",candles:Array.from({length:22},(_,i)=>({time:Math.floor(Date.UTC(2026,8,22+i,6)/1000),open:100,high:102,low:98,close:100,volume:1000}))};
test("source readiness accepts fully declared synthetic inputs",()=>{
 assert.deepEqual(assessDualSurgeSourceReadiness(sample),{ready:true,reasons:[]});
});
test("source readiness fails closed for unapproved provider and incomplete session",()=>{
 const r=assessDualSurgeSourceReadiness({...sample,licenseStatus:"UNKNOWN",completedDate:"2026-10-22"});
 assert.equal(r.ready,false);
 assert.ok(r.reasons.includes("LICENSE_NOT_APPROVED"));
 assert.ok(r.reasons.includes("SESSION_NOT_COMPLETED"));
});
test("candidate preparation refuses missing verification before any DB access",()=>{
 assert.throws(()=>prepareDualSurgeCandidates({...sample,sourceVerified:false}),/SOURCE_NOT_READY:SOURCE_NOT_VERIFIED/);
});
test("source readiness refuses missing candles",()=>{
 assert.ok(assessDualSurgeSourceReadiness({...sample,candles:[]}).reasons.includes("HISTORY_UNAVAILABLE"));
});
