import test from "node:test";
import assert from "node:assert/strict";
import { auditGeneratedScanBeforeForwardResearch as audit } from "../../app/lib/learning/auditGeneratedScanBeforeForwardResearch.mjs";
const source="2026-10-28T06:30:00Z";
const input={scanRunId:"audit-run",tradeDate:"2026-10-28",scanStartedAt:"2026-10-28T06:29:00Z",scanCompletedAt:"2026-10-28T06:35:00Z",payload:{cached:false,updatedAt:"2026-10-28T06:34:00Z",stocks:[{code:"590A",price:1200,aiPower:83,latestBarTimestamp:Date.parse(source)/1000}]}};
test("fresh preview cannot leak into verified performance even with plausible future outcome",()=>{
 const original=structuredClone(input);
 const x=audit(input,[{scan_run_id:"audit-run",code:"590A",independent_source_verified:true,observed_at:"2026-11-05T06:30:00Z",return_pct:20,horizon_days:5,horizon_verified:true,outcome_version:"forward-v1",verified_session_dates:["2026-10-29","2026-10-30","2026-11-02","2026-11-04","2026-11-05"]}]);
 assert.equal(x.preview.accepted,true);
 assert.equal(x.preview.rows[0].capture_status,"QUARANTINED");
 assert.equal(x.report.accepted,0);
 assert.equal(x.report.mean_return_pct,null);
 assert.equal(x.report.positive_rate_pct,null);
 assert.equal(x.report.eligible_for_live_ai,false);
 assert.equal(x.report.rejection_reasons.UNVERIFIED_CAPTURE,1);
 assert.equal(x.saved,false);assert.equal(x.safe_to_promote,false);
 assert.deepEqual(input,original);
});
test("cached Scan fails before forward analysis",()=>{
 const x=audit({...input,payload:{...input.payload,cached:true}},[]);
 assert.equal(x.preview.accepted,false);
 assert.equal(x.report,null);
 assert.equal(x.saved,false);
});
test("non-array future data fails closed",()=>assert.throws(()=>audit(input,{}),/INVALID_RESEARCH_OUTCOMES/));
